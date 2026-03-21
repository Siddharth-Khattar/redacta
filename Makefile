.PHONY: setup clean dev build preview format lint check deploy indexnow

setup:
	cd frontend && bun install

clean:
	rm -rf frontend/node_modules frontend/dist

dev:
	cd frontend && bun run dev

build:
	cd frontend && bun run build

preview: build
	cd frontend && bun run preview

format:
	cd frontend && bunx biome check --write .

lint:
	cd frontend && bunx tsc --noEmit
	cd frontend && bunx biome check .

check: format lint
	@echo "All checks passed."

deploy: build
	npx wrangler deploy
	@$(MAKE) indexnow

indexnow:
	./scripts/indexnow-ping.sh
