# ABOUTME: Rate-limit retry decorator for Gemini API 429 errors.
# ABOUTME: Uses tenacity exponential backoff with settings from config module.

import logging
from collections.abc import Callable
from functools import wraps
from typing import ParamSpec, TypeVar

from google.genai.errors import ClientError
from tenacity import (
    RetryCallState,
    retry,
    retry_if_exception,
    stop_after_attempt,
    wait_exponential,
)

from config import get_settings

logger = logging.getLogger(__name__)


def _is_rate_limit_error(exc: BaseException) -> bool:
    """Return True if the exception is a Gemini 429 rate-limit error."""
    if not isinstance(exc, ClientError):
        return False
    return exc.code == 429


def _log_retry(retry_state: RetryCallState) -> None:
    """Log each retry attempt at WARNING level."""
    assert retry_state.outcome is not None
    exc = retry_state.outcome.exception()
    logger.warning(
        "Gemini rate limit hit (attempt %d/%d). Retrying in %.0fs... [%s]",
        retry_state.attempt_number,
        retry_state.retry_object.stop.max_attempt_number,  # type: ignore[union-attr]
        retry_state.next_action.sleep if retry_state.next_action else 0,  # type: ignore[union-attr]
        exc,
    )


P = ParamSpec("P")
T = TypeVar("T")


def with_gemini_rate_limit_retry(fn: Callable[P, T]) -> Callable[P, T]:
    """Decorator that retries a function on Gemini 429 rate-limit errors.

    Reads retry configuration from the Settings singleton. Uses exponential
    backoff with configurable min/max waits.
    """

    @wraps(fn)
    def wrapper(*args: P.args, **kwargs: P.kwargs) -> T:
        settings = get_settings()
        retryer = retry(
            retry=retry_if_exception(_is_rate_limit_error),
            stop=stop_after_attempt(settings.rate_limit_retry_attempts),
            wait=wait_exponential(
                min=settings.rate_limit_initial_wait,
                max=settings.rate_limit_max_wait,
            ),
            before_sleep=_log_retry,
            reraise=True,
        )
        return retryer(fn)(*args, **kwargs)

    return wrapper
