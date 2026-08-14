.PHONY: help install lint typecheck test build validate

help:
	@printf '%s\n' 'GameAtlas commands:' '  make install   install locked dependencies' '  make lint      run ESLint' '  make typecheck run TypeScript checks' '  make test      run tests' '  make build     build the static Pages export' '  make validate  run the complete local validation bundle'

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

validate:
	npm run lint
	npm run typecheck
	npm run validate:rights
	npm run validate:catalog
	npm test
	npm run build
	test -f out/.nojekyll || touch out/.nojekyll
	npm run validate:export
