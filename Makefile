.PHONY: help install lint typecheck test build report-coverage check-links validate

help:
	@printf '%s\n' 'GameAtlas commands:' '  make install        install locked dependencies' '  make lint           run ESLint' '  make typecheck      run TypeScript checks' '  make test           run tests' '  make build          build the static Pages export' '  make report-coverage refresh the deterministic coverage report' '  make check-links    check published URLs (network, opt-in)' '  make validate       run the complete local validation bundle'

install:
	npm ci

lint:
	npm run lint

typecheck:
	npm run typecheck

test:
	npm test

build:
	npm run build

report-coverage:
	npm run report:coverage -- --write

check-links:
	npm run check:links

validate:
	npm run lint
	npm run typecheck
	npm run validate:rights
	npm run validate:catalog
	npm run validate:catalog-search-index
	npm run validate:catalog-1000
	npm run validate:catalog-chronology
	npm run validate:catalog-expansion
	npm run report:coverage -- --check
	npm test
	npm run build:catalog-1000
	test -f out/.nojekyll || touch out/.nojekyll
	npm run validate:export
