.PHONY: setup clean backend frontend dev format lint check

setup:
	cd backend && rm -rf .venv && python3 -m venv .venv && .venv/bin/pip install -q ".[dev]"
	cd frontend && bun install

clean:
	rm -rf backend/.venv backend/build backend/redaction_app.egg-info backend/__pycache__
	rm -rf frontend/node_modules frontend/dist

backend:
	cd backend && .venv/bin/uvicorn main:app --reload --port 8000

frontend:
	cd frontend && bun run dev

dev:
	@echo "Starting backend and frontend..."
	@make backend & make frontend & wait

format:
	cd backend && .venv/bin/ruff format . && .venv/bin/ruff check --fix .
	cd frontend && bunx biome check --write .

lint:
	cd backend && .venv/bin/ruff check .
	cd backend && .venv/bin/pyright .
	cd frontend && bunx tsc --noEmit
	cd frontend && bunx biome check .

check: format lint
	@echo "All checks passed."
