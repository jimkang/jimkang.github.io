BROWSERIFY = browserify
UGLIFY = node_modules/.bin/uglifyjs

run:
	wzrd app.js:index.js -- \
		-d

build:
	$(BROWSERIFY) app.js | $(UGLIFY) -c -m -o index.js

run-production-style: build
	python -m SimpleHTTPServer
