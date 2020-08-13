var app = (function () {
    'use strict';

    // Svelte's utils
    function noop() {}

    function run(fn) {
      return fn();
    }

    function blank_object() {
      return Object.create(null);
    }

    function run_all(fns) {
      fns.forEach(run);
    }

    function is_function(thing) {
      return typeof thing === 'function';
    }

    function safe_not_equal(a, b) {
      return a != a ? b == b : a !== b || a && typeof a === 'object' || typeof a === 'function';
    }

    function append(target, node) {
      target.appendChild(node);
    }

    function insert(target, node, anchor) {
      target.insertBefore(node, anchor || null);
    }

    function detach(node) {
      node.parentNode.removeChild(node);
    }

    function destroy_each(iterations, detaching) {
      for (let i = 0; i < iterations.length; i += 1) {
        if (iterations[i]) iterations[i].d(detaching);
      }
    }

    function element(name) {
      return document.createElement(name);
    }

    function text(data) {
      return document.createTextNode(data);
    }

    function space() {
      return text(' ');
    }

    function empty() {
      return text('');
    }

    function listen(node, event, handler, options) {
      node.addEventListener(event, handler, options);
      return () => node.removeEventListener(event, handler, options);
    }

    function attr(node, attribute, value) {
      if (value == null) node.removeAttribute(attribute);else if (node.getAttribute(attribute) !== value) node.setAttribute(attribute, value);
    }

    function to_number(value) {
      return value === '' ? undefined : +value;
    }

    function children(element) {
      return Array.from(element.childNodes);
    }

    function set_data(text, data) {
      data = '' + data;
      if (text.data !== data) text.data = data;
    }

    function set_input_value(input, value) {
      if (value != null || input.value) {
        input.value = value;
      }
    }

    // Component tracking
    let current_component;

    function set_current_component(component) {
      current_component = component;
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;

    function schedule_update() {
      if (!update_scheduled) {
        update_scheduled = true;
        resolved_promise.then(flush);
      }
    }

    function add_render_callback(fn) {
      render_callbacks.push(fn);
    }

    let flushing = false;
    const seen_callbacks = new Set();

    function flush() {
      if (flushing) return;
      flushing = true;

      do {
        // first, call beforeUpdate functions
        // and update components
        for (let i = 0; i < dirty_components.length; i += 1) {
          const component = dirty_components[i];
          set_current_component(component);
          update(component.$$);
        }

        dirty_components.length = 0;

        while (binding_callbacks.length) binding_callbacks.pop()(); // then, once components are updated, call
        // afterUpdate functions. This may cause
        // subsequent updates...


        for (let i = 0; i < render_callbacks.length; i += 1) {
          const callback = render_callbacks[i];

          if (!seen_callbacks.has(callback)) {
            // ...so guard against infinite loops
            seen_callbacks.add(callback);
            callback();
          }
        }

        render_callbacks.length = 0;
      } while (dirty_components.length);

      while (flush_callbacks.length) {
        flush_callbacks.pop()();
      }

      update_scheduled = false;
      flushing = false;
      seen_callbacks.clear();
    }

    function update($$) {
      if ($$.fragment !== null) {
        $$.update();
        run_all($$.before_update);
        const dirty = $$.dirty;
        $$.dirty = [-1];
        $$.fragment && $$.fragment.p($$.ctx, dirty);
        $$.after_update.forEach(add_render_callback);
      }
    }

    const outroing = new Set();
    let outros;

    function group_outros() {
      outros = {
        r: 0,
        c: [],
        p: outros // parent group

      };
    }

    function check_outros() {
      if (!outros.r) {
        run_all(outros.c);
      }

      outros = outros.p;
    }

    function transition_in(block, local) {
      if (block && block.i) {
        outroing.delete(block);
        block.i(local);
      }
    }

    function transition_out(block, local, detach, callback) {
      if (block && block.o) {
        if (outroing.has(block)) return;
        outroing.add(block);
        outros.c.push(() => {
          outroing.delete(block);

          if (callback) {
            if (detach) block.d(1);
            callback();
          }
        });
        block.o(local);
      }
    }

    function create_component(block) {
      block && block.c();
    }

    function mount_component(component, target, anchor) {
      const {
        fragment,
        on_mount,
        on_destroy,
        after_update
      } = component.$$;
      fragment && fragment.m(target, anchor); // onMount happens before the initial afterUpdate

      add_render_callback(() => {
        const new_on_destroy = on_mount.map(run).filter(is_function);

        if (on_destroy) {
          on_destroy.push(...new_on_destroy);
        } else {
          // Edge case - component was destroyed immediately,
          // most likely as a result of a binding initialising
          run_all(new_on_destroy);
        }

        component.$$.on_mount = [];
      });
      after_update.forEach(add_render_callback);
    }

    function destroy_component(component, detaching) {
      const $$ = component.$$;

      if ($$.fragment !== null) {
        run_all($$.on_destroy);
        $$.fragment && $$.fragment.d(detaching); // TODO null out other refs, including component.$$ (but need to
        // preserve final state?)

        $$.on_destroy = $$.fragment = null;
        $$.ctx = [];
      }
    }

    function make_dirty(component, i) {
      if (component.$$.dirty[0] === -1) {
        dirty_components.push(component);
        schedule_update();
        component.$$.dirty.fill(0);
      }

      component.$$.dirty[i / 31 | 0] |= 1 << i % 31;
    }

    function init(component, options, instance, create_fragment, not_equal, props, dirty = [-1]) {
      const parent_component = current_component;
      set_current_component(component);
      const prop_values = options.props || {};
      const $$ = component.$$ = {
        fragment: null,
        ctx: null,
        // state
        props,
        update: noop,
        not_equal,
        bound: blank_object(),
        // lifecycle
        on_mount: [],
        on_destroy: [],
        before_update: [],
        after_update: [],
        context: new Map(parent_component ? parent_component.$$.context : []),
        // everything else
        callbacks: blank_object(),
        dirty
      };
      let ready = false;
      $$.ctx = instance ? instance(component, prop_values, (i, ret, ...rest) => {
        const value = rest.length ? rest[0] : ret;

        if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
          if ($$.bound[i]) $$.bound[i](value);
          if (ready) make_dirty(component, i);
        }

        return ret;
      }) : [];
      $$.update();
      ready = true;
      run_all($$.before_update); // `false` as a special case of no DOM component

      $$.fragment = create_fragment ? create_fragment($$.ctx) : false;

      if (options.target) {
        if (options.hydrate) {
          const nodes = children(options.target); // eslint-disable-next-line @typescript-eslint/no-non-null-assertion

          $$.fragment && $$.fragment.l(nodes);
          nodes.forEach(detach);
        } else {
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          $$.fragment && $$.fragment.c();
        }

        if (options.intro) transition_in(component.$$.fragment);
        mount_component(component, options.target, options.anchor);
        flush();
      }

      set_current_component(parent_component);
    }

    class SvelteComponent {
      $destroy() {
        destroy_component(this, 1);
        this.$destroy = noop;
      }

      $on(type, callback) {
        const callbacks = this.$$.callbacks[type] || (this.$$.callbacks[type] = []);
        callbacks.push(callback);
        return () => {
          const index = callbacks.indexOf(callback);
          if (index !== -1) callbacks.splice(index, 1);
        };
      }

      $set() {// overridden by instance, if it has props
      }

    }

    

    // Code for module image-canvas ops
    // Polyfill for canvas.toBlob from MDN.
    if (!HTMLCanvasElement.prototype.toBlob) {
      Object.defineProperty(HTMLCanvasElement.prototype, 'toBlob', {
        value: function (callback, type, quality) {
          var canvas = this;
          setTimeout(function () {
            var binStr = atob(canvas.toDataURL(type, quality).split(',')[1]),
                len = binStr.length,
                arr = new Uint8Array(len);

            for (var i = 0; i < len; i++) {
              arr[i] = binStr.charCodeAt(i);
            }

            callback(new Blob([arr], {
              type: type || 'image/png'
            }));
          });
        }
      });
    }

    function ImageCanvasOps({
      canvas,
      thumbnailCanvas
    }) {
      var ctx = canvas.getContext('2d');
      var thumbCtx;

      if (thumbnailCanvas) {
        thumbCtx = thumbnailCanvas.getContext('2d');
      }

      var img;
      var rotations = 0;
      var loadedImageMIMEType;
      var imageIsLoaded = false;

      function loadFileToCanvas({
        mimeType,
        maxSideLength,
        file
      }, done) {
        img = new Image();
        img.addEventListener('load', drawToCanvas);
        img.src = URL.createObjectURL(file);

        function drawToCanvas() {
          rotations = 0;
          var originalWidth = img.width;
          var originalHeight = img.height;
          var newWidth;
          var newHeight;

          if (originalWidth > originalHeight) {
            newWidth = maxSideLength;
            newHeight = originalHeight * newWidth / originalWidth;
          } else {
            newHeight = maxSideLength;
            newWidth = originalWidth * newHeight / originalHeight;
          }

          canvas.width = newWidth;
          canvas.height = newHeight;
          drawImageToCanvases(img, newWidth, newHeight);
          loadedImageMIMEType = mimeType;
          imageIsLoaded = true;

          if (done) {
            setTimeout(done, 0);
          }
        }
      }

      function getImageFromCanvas(done) {
        try {
          canvas.toBlob(passBlob, loadedImageMIMEType, 0.7);
        } catch (error) {
          done(error);
        }

        function passBlob(blob) {
          done(null, blob);
        }
      }

      function canvasHasImage() {
        return imageIsLoaded;
      }

      function rotateImage() {
        if (!canvasHasImage()) {
          return;
        }

        rotations += 1;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        var oldWidth = canvas.width;
        var oldHeight = canvas.height;
        canvas.width = oldHeight;
        canvas.height = oldWidth;
        var angle = rotations * Math.PI / 2;
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate(angle); // Sadly, I'm not entirely sure why this works.

        if (rotations % 2 === 1) {
          ctx.translate(-oldWidth / 2, -oldHeight / 2);
          drawImageToCanvases(img, canvas.height, canvas.width);
        } else {
          ctx.translate(-canvas.width / 2, -canvas.height / 2);
          drawImageToCanvases(img, canvas.width, canvas.height);
        }
      }

      function drawImageToCanvases(img, width, height) {
        ctx.drawImage(img, 0, 0, width, height); // Copy stuff to the thumbnail canvas.
        // TODO: Scale thumbnail appropriately.

        if (thumbCtx && thumbnailCanvas) {
          thumbnailCanvas.width = 300;
          thumbnailCanvas.height = 200;
          thumbCtx.drawImage(canvas, 0, 0, canvas.width, canvas.height, 0, 0, 300, 200);
        }
      }

      function clearCanvases() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        thumbCtx.clearRect(0, 0, thumbnailCanvas.width, thumbnailCanvas.height);
      }

      return {
        loadFileToCanvas,
        getImageFromCanvas,
        canvasHasImage,
        rotateImage,
        clearCanvases
      };
    }

    var imageCanvasOps = ImageCanvasOps;


    /* node_modules/svelte-error-message/src/ErrorMessage.svelte generated by Svelte v3.20.1 */

    function create_if_block(ctx) {
    	let div1;
    	let div0;
    	let t0_value = /*error*/ ctx[0].message + "";
    	let t0;
    	let t1;
    	let pre;
    	let t2_value = /*error*/ ctx[0].stack + "";
    	let t2;

    	return {
    		c() {
    			div1 = element("div");
    			div0 = element("div");
    			t0 = text(t0_value);
    			t1 = space();
    			pre = element("pre");
    			t2 = text(t2_value);
    			attr(div1, "class", "error-message");
    		},
    		m(target, anchor) {
    			insert(target, div1, anchor);
    			append(div1, div0);
    			append(div0, t0);
    			append(div1, t1);
    			append(div1, pre);
    			append(pre, t2);
    		},
    		p(ctx, dirty) {
    			if (dirty & /*error*/ 1 && t0_value !== (t0_value = /*error*/ ctx[0].message + "")) set_data(t0, t0_value);
    			if (dirty & /*error*/ 1 && t2_value !== (t2_value = /*error*/ ctx[0].stack + "")) set_data(t2, t2_value);
    		},
    		d(detaching) {
    			if (detaching) detach(div1);
    		}
    	};
    }

    function create_fragment(ctx) {
    	let if_block_anchor;
    	let if_block = /*error*/ ctx[0] && create_if_block(ctx);

    	return {
    		c() {
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    		},
    		m(target, anchor) {
    			if (if_block) if_block.m(target, anchor);
    			insert(target, if_block_anchor, anchor);
    		},
    		p(ctx, [dirty]) {
    			if (/*error*/ ctx[0]) {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block(ctx);
    					if_block.c();
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}
    		},
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach(if_block_anchor);
    		}
    	};
    }

    function instance($$self, $$props, $$invalidate) {
    	let { error } = $$props;

    	$$self.$set = $$props => {
    		if ("error" in $$props) $$invalidate(0, error = $$props.error);
    	};

    	return [error];
    }

    class ErrorMessage extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance, create_fragment, safe_not_equal, { error: 0 });
    	}
    }

    function createOKNOKCallback({
      ok,
      nok,
      log = console.log
    }) {
      return function standardBailCallback(error) {
        if (error) {
          if (log) {
            if (error.stack) {
              log(error, error.stack);
            } else {
              log(error);
            }
          }

          if (nok) {
            nok(error);
          }
        } else if (ok) {
          var okArgs = Array.prototype.slice.call(arguments, 1);

          if (nok) {
            okArgs.push(nok);
          }

          ok.apply(ok, okArgs);
        }
      };
    }

    var oknok = createOKNOKCallback;

    /* src/Picture.svelte generated by Svelte v3.20.1 */

    function create_fragment$1(ctx) {
    	let li;
    	let h1;
    	let t0;
    	let t1;
    	let div;
    	let t2;
    	let input;
    	let input_updating = false;
    	let t3;
    	let img;
    	let img_src_value;
    	let img_alt_value;
    	let t4;
    	let current;
    	let dispose;

    	function input_input_handler() {
    		input_updating = true;
    		/*input_input_handler*/ ctx[5].call(input);
    	}

    	const errormessage = new ErrorMessage({ props: { error: /*error*/ ctx[2] } });

    	return {
    		c() {
    			li = element("li");
    			h1 = element("h1");
    			t0 = text(/*index*/ ctx[0]);
    			t1 = space();
    			div = element("div");
    			t2 = text("Seconds: ");
    			input = element("input");
    			t3 = space();
    			img = element("img");
    			t4 = space();
    			create_component(errormessage.$$.fragment);
    			attr(input, "type", "number");
    			attr(input, "step", "0.1");
    			if (img.src !== (img_src_value = URL.createObjectURL(/*pictureCopy*/ ctx[1].file))) attr(img, "src", img_src_value);
    			attr(img, "alt", img_alt_value = "Picture " + /*index*/ ctx[0]);
    			attr(img, "class", "picture-img");
    			attr(img, "decoding", "sync");
    			attr(li, "class", "picture");
    		},
    		m(target, anchor, remount) {
    			insert(target, li, anchor);
    			append(li, h1);
    			append(h1, t0);
    			append(li, t1);
    			append(li, div);
    			append(div, t2);
    			append(div, input);
    			set_input_value(input, /*pictureCopy*/ ctx[1].seconds);
    			append(li, t3);
    			append(li, img);
    			append(li, t4);
    			mount_component(errormessage, li, null);
    			current = true;
    			if (remount) dispose();
    			dispose = listen(input, "input", input_input_handler);
    		},
    		p(ctx, [dirty]) {
    			if (!current || dirty & /*index*/ 1) set_data(t0, /*index*/ ctx[0]);

    			if (!input_updating && dirty & /*pictureCopy*/ 2) {
    				set_input_value(input, /*pictureCopy*/ ctx[1].seconds);
    			}

    			input_updating = false;

    			if (!current || dirty & /*pictureCopy*/ 2 && img.src !== (img_src_value = URL.createObjectURL(/*pictureCopy*/ ctx[1].file))) {
    				attr(img, "src", img_src_value);
    			}

    			if (!current || dirty & /*index*/ 1 && img_alt_value !== (img_alt_value = "Picture " + /*index*/ ctx[0])) {
    				attr(img, "alt", img_alt_value);
    			}

    			const errormessage_changes = {};
    			if (dirty & /*error*/ 4) errormessage_changes.error = /*error*/ ctx[2];
    			errormessage.$set(errormessage_changes);
    		},
    		i(local) {
    			if (current) return;
    			transition_in(errormessage.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(errormessage.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			if (detaching) detach(li);
    			destroy_component(errormessage);
    			dispose();
    		}
    	};
    }

    function instance$1($$self, $$props, $$invalidate) {
    	let { index } = $$props;
    	let { picture } = $$props;
    	let pictureCopy;

    	//interface Picture {
    	//file: File;
    	//seconds: number;
    	//maxSideLength: number;
    	//width: number;
    	//height: number;
    	//}
    	let error;

    	function resizeImage() {
    		var canvas = document.createElement("canvas");
    		var imageCanvasOps$1 = imageCanvasOps({ canvas });

    		imageCanvasOps$1.loadFileToCanvas(
    			{
    				file: pictureCopy.file,
    				mimeType: pictureCopy.file.type,
    				maxSideLength: pictureCopy.maxSideLength
    			},
    			oknok({ ok: getImage, nok: setError })
    		);

    		function getImage() {
    			imageCanvasOps$1.getImageFromCanvas(oknok({ ok: useImage, nok: setError }));
    		}

    		function useImage(imageBlob) {
    			$$invalidate(1, pictureCopy.file = imageBlob, pictureCopy);

    			// Depending on a side effect here: The canvas will
    			// be resized when the image is resized.
    			$$invalidate(1, pictureCopy.width = canvas.width, pictureCopy);

    			$$invalidate(1, pictureCopy.height = canvas.height, pictureCopy);
    			canvas = undefined;
    		} // TODO: See if the canvas gets deallocated.

    		function setError(theError) {
    			$$invalidate(2, error = theError);
    			canvas = undefined;
    		} // TODO: See if the canvas gets deallocated.
    	}

    	function input_input_handler() {
    		pictureCopy.seconds = to_number(this.value);
    		($$invalidate(1, pictureCopy), $$invalidate(3, picture));
    	}

    	$$self.$set = $$props => {
    		if ("index" in $$props) $$invalidate(0, index = $$props.index);
    		if ("picture" in $$props) $$invalidate(3, picture = $$props.picture);
    	};

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*picture*/ 8) {
    			 if (picture.file) {
    				$$invalidate(1, pictureCopy = picture);
    				resizeImage();
    			}
    		}
    	};

    	return [index, pictureCopy, error, picture, resizeImage, input_input_handler];
    }

    class Picture extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance$1, create_fragment$1, safe_not_equal, { index: 0, picture: 3 });
    	}
    }

    // gif.js module
    function commonjsRequire () {
    	throw new Error('Dynamic requires are not currently supported by @rollup/plugin-commonjs');
    }

    function createCommonjsModule(fn, module) {
    	return module = { exports: {} }, fn(module, module.exports), module.exports;
    }

    var gif = createCommonjsModule(function (module, exports) {
      // gif.js 0.2.0 - https://github.com/jnordberg/gif.js
      (function (f) {
        {
          module.exports = f();
        }
      })(function () {
        return function e(t, n, r) {
          function s(o, u) {
            if (!n[o]) {
              if (!t[o]) {
                var a = typeof commonjsRequire == "function" && commonjsRequire;
                if (!u && a) return a(o, !0);
                if (i) return i(o, !0);
                var f = new Error("Cannot find module '" + o + "'");
                throw f.code = "MODULE_NOT_FOUND", f;
              }

              var l = n[o] = {
                exports: {}
              };
              t[o][0].call(l.exports, function (e) {
                var n = t[o][1][e];
                return s(n ? n : e);
              }, l, l.exports, e, t, n, r);
            }

            return n[o].exports;
          }

          var i = typeof commonjsRequire == "function" && commonjsRequire;

          for (var o = 0; o < r.length; o++) s(r[o]);

          return s;
        }({
          1: [function (require, module, exports) {
            function EventEmitter() {
              this._events = this._events || {};
              this._maxListeners = this._maxListeners || undefined;
            }

            module.exports = EventEmitter;
            EventEmitter.EventEmitter = EventEmitter;
            EventEmitter.prototype._events = undefined;
            EventEmitter.prototype._maxListeners = undefined;
            EventEmitter.defaultMaxListeners = 10;

            EventEmitter.prototype.setMaxListeners = function (n) {
              if (!isNumber(n) || n < 0 || isNaN(n)) throw TypeError("n must be a positive number");
              this._maxListeners = n;
              return this;
            };

            EventEmitter.prototype.emit = function (type) {
              var er, handler, len, args, i, listeners;
              if (!this._events) this._events = {};

              if (type === "error") {
                if (!this._events.error || isObject(this._events.error) && !this._events.error.length) {
                  er = arguments[1];

                  if (er instanceof Error) {
                    throw er;
                  } else {
                    var err = new Error('Uncaught, unspecified "error" event. (' + er + ")");
                    err.context = er;
                    throw err;
                  }
                }
              }

              handler = this._events[type];
              if (isUndefined(handler)) return false;

              if (isFunction(handler)) {
                switch (arguments.length) {
                  case 1:
                    handler.call(this);
                    break;

                  case 2:
                    handler.call(this, arguments[1]);
                    break;

                  case 3:
                    handler.call(this, arguments[1], arguments[2]);
                    break;

                  default:
                    args = Array.prototype.slice.call(arguments, 1);
                    handler.apply(this, args);
                }
              } else if (isObject(handler)) {
                args = Array.prototype.slice.call(arguments, 1);
                listeners = handler.slice();
                len = listeners.length;

                for (i = 0; i < len; i++) listeners[i].apply(this, args);
              }

              return true;
            };

            EventEmitter.prototype.addListener = function (type, listener) {
              var m;
              if (!isFunction(listener)) throw TypeError("listener must be a function");
              if (!this._events) this._events = {};
              if (this._events.newListener) this.emit("newListener", type, isFunction(listener.listener) ? listener.listener : listener);
              if (!this._events[type]) this._events[type] = listener;else if (isObject(this._events[type])) this._events[type].push(listener);else this._events[type] = [this._events[type], listener];

              if (isObject(this._events[type]) && !this._events[type].warned) {
                if (!isUndefined(this._maxListeners)) {
                  m = this._maxListeners;
                } else {
                  m = EventEmitter.defaultMaxListeners;
                }

                if (m && m > 0 && this._events[type].length > m) {
                  this._events[type].warned = true;
                  console.error("(node) warning: possible EventEmitter memory " + "leak detected. %d listeners added. " + "Use emitter.setMaxListeners() to increase limit.", this._events[type].length);

                  if (typeof console.trace === "function") {
                    console.trace();
                  }
                }
              }

              return this;
            };

            EventEmitter.prototype.on = EventEmitter.prototype.addListener;

            EventEmitter.prototype.once = function (type, listener) {
              if (!isFunction(listener)) throw TypeError("listener must be a function");
              var fired = false;

              function g() {
                this.removeListener(type, g);

                if (!fired) {
                  fired = true;
                  listener.apply(this, arguments);
                }
              }

              g.listener = listener;
              this.on(type, g);
              return this;
            };

            EventEmitter.prototype.removeListener = function (type, listener) {
              var list, position, length, i;
              if (!isFunction(listener)) throw TypeError("listener must be a function");
              if (!this._events || !this._events[type]) return this;
              list = this._events[type];
              length = list.length;
              position = -1;

              if (list === listener || isFunction(list.listener) && list.listener === listener) {
                delete this._events[type];
                if (this._events.removeListener) this.emit("removeListener", type, listener);
              } else if (isObject(list)) {
                for (i = length; i-- > 0;) {
                  if (list[i] === listener || list[i].listener && list[i].listener === listener) {
                    position = i;
                    break;
                  }
                }

                if (position < 0) return this;

                if (list.length === 1) {
                  list.length = 0;
                  delete this._events[type];
                } else {
                  list.splice(position, 1);
                }

                if (this._events.removeListener) this.emit("removeListener", type, listener);
              }

              return this;
            };

            EventEmitter.prototype.removeAllListeners = function (type) {
              var key, listeners;
              if (!this._events) return this;

              if (!this._events.removeListener) {
                if (arguments.length === 0) this._events = {};else if (this._events[type]) delete this._events[type];
                return this;
              }

              if (arguments.length === 0) {
                for (key in this._events) {
                  if (key === "removeListener") continue;
                  this.removeAllListeners(key);
                }

                this.removeAllListeners("removeListener");
                this._events = {};
                return this;
              }

              listeners = this._events[type];

              if (isFunction(listeners)) {
                this.removeListener(type, listeners);
              } else if (listeners) {
                while (listeners.length) this.removeListener(type, listeners[listeners.length - 1]);
              }

              delete this._events[type];
              return this;
            };

            EventEmitter.prototype.listeners = function (type) {
              var ret;
              if (!this._events || !this._events[type]) ret = [];else if (isFunction(this._events[type])) ret = [this._events[type]];else ret = this._events[type].slice();
              return ret;
            };

            EventEmitter.prototype.listenerCount = function (type) {
              if (this._events) {
                var evlistener = this._events[type];
                if (isFunction(evlistener)) return 1;else if (evlistener) return evlistener.length;
              }

              return 0;
            };

            EventEmitter.listenerCount = function (emitter, type) {
              return emitter.listenerCount(type);
            };

            function isFunction(arg) {
              return typeof arg === "function";
            }

            function isNumber(arg) {
              return typeof arg === "number";
            }

            function isObject(arg) {
              return typeof arg === "object" && arg !== null;
            }

            function isUndefined(arg) {
              return arg === void 0;
            }
          }, {}],
          2: [function (require, module, exports) {
            var UA, browser, mode, platform, ua;
            ua = navigator.userAgent.toLowerCase();
            platform = navigator.platform.toLowerCase();
            UA = ua.match(/(opera|ie|firefox|chrome|version)[\s\/:]([\w\d\.]+)?.*?(safari|version[\s\/:]([\w\d\.]+)|$)/) || [null, "unknown", 0];
            mode = UA[1] === "ie" && document.documentMode;
            browser = {
              name: UA[1] === "version" ? UA[3] : UA[1],
              version: mode || parseFloat(UA[1] === "opera" && UA[4] ? UA[4] : UA[2]),
              platform: {
                name: ua.match(/ip(?:ad|od|hone)/) ? "ios" : (ua.match(/(?:webos|android)/) || platform.match(/mac|win|linux/) || ["other"])[0]
              }
            };
            browser[browser.name] = true;
            browser[browser.name + parseInt(browser.version, 10)] = true;
            browser.platform[browser.platform.name] = true;
            module.exports = browser;
          }, {}],
          3: [function (require, module, exports) {
            var EventEmitter,
                GIF,
                browser,
                extend = function (child, parent) {
              for (var key in parent) {
                if (hasProp.call(parent, key)) child[key] = parent[key];
              }

              function ctor() {
                this.constructor = child;
              }

              ctor.prototype = parent.prototype;
              child.prototype = new ctor();
              child.__super__ = parent.prototype;
              return child;
            },
                hasProp = {}.hasOwnProperty,
                indexOf = [].indexOf || function (item) {
              for (var i = 0, l = this.length; i < l; i++) {
                if (i in this && this[i] === item) return i;
              }

              return -1;
            },
                slice = [].slice;

            EventEmitter = require("events").EventEmitter;
            browser = require("./browser.coffee");

            GIF = function (superClass) {
              var defaults, frameDefaults;
              extend(GIF, superClass);
              defaults = {
                workerScript: "gif.worker.js",
                workers: 2,
                repeat: 0,
                background: "#fff",
                quality: 10,
                width: null,
                height: null,
                transparent: null,
                debug: false,
                dither: false
              };
              frameDefaults = {
                delay: 500,
                copy: false
              };

              function GIF(options) {
                var base, key, value;
                this.running = false;
                this.options = {};
                this.frames = [];
                this.freeWorkers = [];
                this.activeWorkers = [];
                this.setOptions(options);

                for (key in defaults) {
                  value = defaults[key];

                  if ((base = this.options)[key] == null) {
                    base[key] = value;
                  }
                }
              }

              GIF.prototype.setOption = function (key, value) {
                this.options[key] = value;

                if (this._canvas != null && (key === "width" || key === "height")) {
                  return this._canvas[key] = value;
                }
              };

              GIF.prototype.setOptions = function (options) {
                var key, results, value;
                results = [];

                for (key in options) {
                  if (!hasProp.call(options, key)) continue;
                  value = options[key];
                  results.push(this.setOption(key, value));
                }

                return results;
              };

              GIF.prototype.addFrame = function (image, options) {
                var frame, key;

                if (options == null) {
                  options = {};
                }

                frame = {};
                frame.transparent = this.options.transparent;

                for (key in frameDefaults) {
                  frame[key] = options[key] || frameDefaults[key];
                }

                if (this.options.width == null) {
                  this.setOption("width", image.width);
                }

                if (this.options.height == null) {
                  this.setOption("height", image.height);
                }

                if (typeof ImageData !== "undefined" && ImageData !== null && image instanceof ImageData) {
                  frame.data = image.data;
                } else if (typeof CanvasRenderingContext2D !== "undefined" && CanvasRenderingContext2D !== null && image instanceof CanvasRenderingContext2D || typeof WebGLRenderingContext !== "undefined" && WebGLRenderingContext !== null && image instanceof WebGLRenderingContext) {
                  if (options.copy) {
                    frame.data = this.getContextData(image);
                  } else {
                    frame.context = image;
                  }
                } else if (image.childNodes != null) {
                  if (options.copy) {
                    frame.data = this.getImageData(image);
                  } else {
                    frame.image = image;
                  }
                } else {
                  throw new Error("Invalid image");
                }

                return this.frames.push(frame);
              };

              GIF.prototype.render = function () {
                var i, j, numWorkers, ref;

                if (this.running) {
                  throw new Error("Already running");
                }

                if (this.options.width == null || this.options.height == null) {
                  throw new Error("Width and height must be set prior to rendering");
                }

                this.running = true;
                this.nextFrame = 0;
                this.finishedFrames = 0;

                this.imageParts = function () {
                  var j, ref, results;
                  results = [];

                  for (i = j = 0, ref = this.frames.length; 0 <= ref ? j < ref : j > ref; i = 0 <= ref ? ++j : --j) {
                    results.push(null);
                  }

                  return results;
                }.call(this);

                numWorkers = this.spawnWorkers();

                if (this.options.globalPalette === true) {
                  this.renderNextFrame();
                } else {
                  for (i = j = 0, ref = numWorkers; 0 <= ref ? j < ref : j > ref; i = 0 <= ref ? ++j : --j) {
                    this.renderNextFrame();
                  }
                }

                this.emit("start");
                return this.emit("progress", 0);
              };

              GIF.prototype.abort = function () {
                var worker;

                while (true) {
                  worker = this.activeWorkers.shift();

                  if (worker == null) {
                    break;
                  }

                  this.log("killing active worker");
                  worker.terminate();
                }

                this.running = false;
                return this.emit("abort");
              };

              GIF.prototype.spawnWorkers = function () {
                var numWorkers, ref, results;
                numWorkers = Math.min(this.options.workers, this.frames.length);
                (function () {
                  results = [];

                  for (var j = ref = this.freeWorkers.length; ref <= numWorkers ? j < numWorkers : j > numWorkers; ref <= numWorkers ? j++ : j--) {
                    results.push(j);
                  }

                  return results;
                }).apply(this).forEach(function (_this) {
                  return function (i) {
                    var worker;

                    _this.log("spawning worker " + i);

                    worker = new Worker(_this.options.workerScript);

                    worker.onmessage = function (event) {
                      _this.activeWorkers.splice(_this.activeWorkers.indexOf(worker), 1);

                      _this.freeWorkers.push(worker);

                      return _this.frameFinished(event.data);
                    };

                    return _this.freeWorkers.push(worker);
                  };
                }(this));
                return numWorkers;
              };

              GIF.prototype.frameFinished = function (frame) {
                var i, j, ref;
                this.log("frame " + frame.index + " finished - " + this.activeWorkers.length + " active");
                this.finishedFrames++;
                this.emit("progress", this.finishedFrames / this.frames.length);
                this.imageParts[frame.index] = frame;

                if (this.options.globalPalette === true) {
                  this.options.globalPalette = frame.globalPalette;
                  this.log("global palette analyzed");

                  if (this.frames.length > 2) {
                    for (i = j = 1, ref = this.freeWorkers.length; 1 <= ref ? j < ref : j > ref; i = 1 <= ref ? ++j : --j) {
                      this.renderNextFrame();
                    }
                  }
                }

                if (indexOf.call(this.imageParts, null) >= 0) {
                  return this.renderNextFrame();
                } else {
                  return this.finishRendering();
                }
              };

              GIF.prototype.finishRendering = function () {
                var data, frame, i, image, j, k, l, len, len1, len2, len3, offset, page, ref, ref1, ref2;
                len = 0;
                ref = this.imageParts;

                for (j = 0, len1 = ref.length; j < len1; j++) {
                  frame = ref[j];
                  len += (frame.data.length - 1) * frame.pageSize + frame.cursor;
                }

                len += frame.pageSize - frame.cursor;
                this.log("rendering finished - filesize " + Math.round(len / 1e3) + "kb");
                data = new Uint8Array(len);
                offset = 0;
                ref1 = this.imageParts;

                for (k = 0, len2 = ref1.length; k < len2; k++) {
                  frame = ref1[k];
                  ref2 = frame.data;

                  for (i = l = 0, len3 = ref2.length; l < len3; i = ++l) {
                    page = ref2[i];
                    data.set(page, offset);

                    if (i === frame.data.length - 1) {
                      offset += frame.cursor;
                    } else {
                      offset += frame.pageSize;
                    }
                  }
                }

                image = new Blob([data], {
                  type: "image/gif"
                });
                return this.emit("finished", image, data);
              };

              GIF.prototype.renderNextFrame = function () {
                var frame, task, worker;

                if (this.freeWorkers.length === 0) {
                  throw new Error("No free workers");
                }

                if (this.nextFrame >= this.frames.length) {
                  return;
                }

                frame = this.frames[this.nextFrame++];
                worker = this.freeWorkers.shift();
                task = this.getTask(frame);
                this.log("starting frame " + (task.index + 1) + " of " + this.frames.length);
                this.activeWorkers.push(worker);
                return worker.postMessage(task);
              };

              GIF.prototype.getContextData = function (ctx) {
                return ctx.getImageData(0, 0, this.options.width, this.options.height).data;
              };

              GIF.prototype.getImageData = function (image) {
                var ctx;

                if (this._canvas == null) {
                  this._canvas = document.createElement("canvas");
                  this._canvas.width = this.options.width;
                  this._canvas.height = this.options.height;
                }

                ctx = this._canvas.getContext("2d");
                ctx.setFill = this.options.background;
                ctx.fillRect(0, 0, this.options.width, this.options.height);
                ctx.drawImage(image, 0, 0);
                return this.getContextData(ctx);
              };

              GIF.prototype.getTask = function (frame) {
                var index, task;
                index = this.frames.indexOf(frame);
                task = {
                  index: index,
                  last: index === this.frames.length - 1,
                  delay: frame.delay,
                  transparent: frame.transparent,
                  width: this.options.width,
                  height: this.options.height,
                  quality: this.options.quality,
                  dither: this.options.dither,
                  globalPalette: this.options.globalPalette,
                  repeat: this.options.repeat,
                  canTransfer: browser.name === "chrome"
                };

                if (frame.data != null) {
                  task.data = frame.data;
                } else if (frame.context != null) {
                  task.data = this.getContextData(frame.context);
                } else if (frame.image != null) {
                  task.data = this.getImageData(frame.image);
                } else {
                  throw new Error("Invalid frame");
                }

                return task;
              };

              GIF.prototype.log = function () {
                var args;
                args = 1 <= arguments.length ? slice.call(arguments, 0) : [];

                if (!this.options.debug) {
                  return;
                }

                return console.log.apply(console, args);
              };

              return GIF;
            }(EventEmitter);

            module.exports = GIF;
          }, {
            "./browser.coffee": 2,
            events: 1
          }]
        }, {}, [3])(3);
      });
    });

   
    // User module: picturesToAnimatedGif 
    function picturesToAnimatedGif({
      imgNodeList,
      pictures
    }, done) {
      if (imgNodeList.length < 1) {
        throw new Error('No pictures passed to picturesToAnimatedGif.');
      }

      var enclosingBox = pictures.reduce(getEnclosingBox, {
        width: 0,
        height: 0
      });
      var gif$1 = new gif({
        workers: 2,
        quality: 10,
        width: enclosingBox.width,
        height: enclosingBox.height
      });

      for (var i = 0; i < imgNodeList.length; ++i) {
        addToGif(imgNodeList[i], pictures[i]);
      }

      gif$1.on('finished', passBlob); // TODO: Is there an error event?

      gif$1.render();

      function addToGif(img, picture) {
        const delay = picture.seconds * 1000;
        gif$1.addFrame(img, {
          delay,
          copy: true,
          dispose: 2
        });
      }

      function passBlob(blob) {
        done(null, blob);
      }
    }

    function getEnclosingBox(box, picture) {
      if (picture.width > box.width) {
        box.width = picture.width;
      }

      if (picture.height > box.height) {
        box.height = picture.height;
      }

      return box;
    }

    // Return a promise that resolves with the error, even when it
    // catches the error.
    // Expecting params: callback calling function, arguments for that function.
    async function errorbackPromise(callbackCaller) {
      var params = sliceArgumentsAfterFirstOneIntoParamArray(arguments);
      return new Promise(executor);

      function executor(resolve) {
        params.push(callback);
        callbackCaller.apply(callbackCaller, params);

        function callback(error) {
          resolve({
            error,
            values: sliceArgumentsAfterFirstOneIntoParamArray(arguments)
          });
        }
      }
    } // This does not use Array.prototype.slice.call on `arguments` because V8 does not
    // know how to optimize one function's `arguments` being used outside that function.
    // TODO: Find out if this is still an issue.


    function sliceArgumentsAfterFirstOneIntoParamArray(args) {
      var argsLength = args.length;
      var params = [];

      if (argsLength > 1) {
        params = new Array(argsLength - 1);

        for (var i = 1; i < argsLength; ++i) {
          params[i - 1] = args[i];
        }
      }

      return params;
    }

    var errorbackPromise_1 = errorbackPromise;

    /* src/Movie.svelte generated by Svelte v3.20.1 */

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[5] = list[i];
    	child_ctx[7] = i;
    	return child_ctx;
    }

    // (58:4) {#each pictures as picture, index }
    function create_each_block(ctx) {
    	let current;

    	const picture = new Picture({
    			props: {
    				index: /*index*/ ctx[7],
    				picture: /*picture*/ ctx[5]
    			}
    		});

    	return {
    		c() {
    			create_component(picture.$$.fragment);
    		},
    		m(target, anchor) {
    			mount_component(picture, target, anchor);
    			current = true;
    		},
    		p(ctx, dirty) {
    			const picture_changes = {};
    			if (dirty & /*pictures*/ 4) picture_changes.picture = /*picture*/ ctx[5];
    			picture.$set(picture_changes);
    		},
    		i(local) {
    			if (current) return;
    			transition_in(picture.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(picture.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			destroy_component(picture, detaching);
    		}
    	};
    }

    // (65:2) {#if processingInProgress }
    function create_if_block_1(ctx) {
    	let div;

    	return {
    		c() {
    			div = element("div");
    			div.textContent = "Building your gif…";
    			attr(div, "class", "processing-message svelte-uon7n8");
    		},
    		m(target, anchor) {
    			insert(target, div, anchor);
    		},
    		d(detaching) {
    			if (detaching) detach(div);
    		}
    	};
    }

    // (69:2) {#if resultGifBlob }
    function create_if_block$1(ctx) {
    	let div;
    	let img;
    	let img_src_value;
    	let t0;
    	let em;

    	return {
    		c() {
    			div = element("div");
    			img = element("img");
    			t0 = space();
    			em = element("em");
    			em.textContent = "Right-click or hold your finger down over the gif to download it.";
    			attr(img, "id", "result-gif");
    			if (img.src !== (img_src_value = URL.createObjectURL(/*resultGifBlob*/ ctx[0], { type: "image/gif" }))) attr(img, "src", img_src_value);
    			attr(img, "alt", "The resulting movie gif!");
    			attr(div, "class", "result-zone centered-col svelte-uon7n8");
    		},
    		m(target, anchor) {
    			insert(target, div, anchor);
    			append(div, img);
    			append(div, t0);
    			append(div, em);
    		},
    		p(ctx, dirty) {
    			if (dirty & /*resultGifBlob*/ 1 && img.src !== (img_src_value = URL.createObjectURL(/*resultGifBlob*/ ctx[0], { type: "image/gif" }))) {
    				attr(img, "src", img_src_value);
    			}
    		},
    		d(detaching) {
    			if (detaching) detach(div);
    		}
    	};
    }

    function create_fragment$2(ctx) {
    	let section;
    	let h3;
    	let t1;
    	let input;
    	let t2;
    	let ul;
    	let t3;
    	let button;
    	let t5;
    	let t6;
    	let t7;
    	let canvas;
    	let current;
    	let dispose;
    	let each_value = /*pictures*/ ctx[2];
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
    	}

    	const out = i => transition_out(each_blocks[i], 1, 1, () => {
    		each_blocks[i] = null;
    	});

    	let if_block0 = /*processingInProgress*/ ctx[1] && create_if_block_1();
    	let if_block1 = /*resultGifBlob*/ ctx[0] && create_if_block$1(ctx);

    	return {
    		c() {
    			section = element("section");
    			h3 = element("h3");
    			h3.textContent = "Pick pictures to add:";
    			t1 = space();
    			input = element("input");
    			t2 = space();
    			ul = element("ul");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t3 = space();
    			button = element("button");
    			button.textContent = "Make gif!";
    			t5 = space();
    			if (if_block0) if_block0.c();
    			t6 = space();
    			if (if_block1) if_block1.c();
    			t7 = space();
    			canvas = element("canvas");
    			attr(input, "id", "image-picker");
    			attr(input, "type", "file");
    			input.multiple = true;
    			attr(input, "accept", "image/*");
    			attr(ul, "class", "picture-list svelte-uon7n8");
    			attr(button, "id", "make-gif-button");
    			attr(section, "class", "centered-col");
    			attr(canvas, "id", "frame-canvas");
    		},
    		m(target, anchor, remount) {
    			insert(target, section, anchor);
    			append(section, h3);
    			append(section, t1);
    			append(section, input);
    			append(section, t2);
    			append(section, ul);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(ul, null);
    			}

    			append(section, t3);
    			append(section, button);
    			append(section, t5);
    			if (if_block0) if_block0.m(section, null);
    			append(section, t6);
    			if (if_block1) if_block1.m(section, null);
    			insert(target, t7, anchor);
    			insert(target, canvas, anchor);
    			current = true;
    			if (remount) run_all(dispose);

    			dispose = [
    				listen(input, "change", /*onImagePickerChange*/ ctx[3]),
    				listen(button, "click", /*onMakeGifClick*/ ctx[4])
    			];
    		},
    		p(ctx, [dirty]) {
    			if (dirty & /*pictures*/ 4) {
    				each_value = /*pictures*/ ctx[2];
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    						transition_in(each_blocks[i], 1);
    					} else {
    						each_blocks[i] = create_each_block(child_ctx);
    						each_blocks[i].c();
    						transition_in(each_blocks[i], 1);
    						each_blocks[i].m(ul, null);
    					}
    				}

    				group_outros();

    				for (i = each_value.length; i < each_blocks.length; i += 1) {
    					out(i);
    				}

    				check_outros();
    			}

    			if (/*processingInProgress*/ ctx[1]) {
    				if (!if_block0) {
    					if_block0 = create_if_block_1();
    					if_block0.c();
    					if_block0.m(section, t6);
    				}
    			} else if (if_block0) {
    				if_block0.d(1);
    				if_block0 = null;
    			}

    			if (/*resultGifBlob*/ ctx[0]) {
    				if (if_block1) {
    					if_block1.p(ctx, dirty);
    				} else {
    					if_block1 = create_if_block$1(ctx);
    					if_block1.c();
    					if_block1.m(section, null);
    				}
    			} else if (if_block1) {
    				if_block1.d(1);
    				if_block1 = null;
    			}
    		},
    		i(local) {
    			if (current) return;

    			for (let i = 0; i < each_value.length; i += 1) {
    				transition_in(each_blocks[i]);
    			}

    			current = true;
    		},
    		o(local) {
    			each_blocks = each_blocks.filter(Boolean);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				transition_out(each_blocks[i]);
    			}

    			current = false;
    		},
    		d(detaching) {
    			if (detaching) detach(section);
    			destroy_each(each_blocks, detaching);
    			if (if_block0) if_block0.d();
    			if (if_block1) if_block1.d();
    			if (detaching) detach(t7);
    			if (detaching) detach(canvas);
    			run_all(dispose);
    		}
    	};
    }

    let maxSideLength = 1024;

    function instance$2($$self, $$props, $$invalidate) {
    	let resultGifBlob;
    	let processingInProgress = false;

    	function onImagePickerChange() {
    		var newPictures = [];

    		for (var i = 0; i < this.files.length; ++i) {
    			newPictures.push({
    				seconds: 1,
    				file: this.files[i],
    				maxSideLength,
    				width: 0,
    				height: 0
    			});
    		}

    		$$invalidate(2, pictures = newPictures);
    	}

    	async function onMakeGifClick() {
    		var imgNodeList = document.querySelectorAll(".picture-img");
    		$$invalidate(0, resultGifBlob = null);
    		$$invalidate(1, processingInProgress = true);
    		var { error, values } = await errorbackPromise_1(picturesToAnimatedGif, { imgNodeList, pictures });
    		$$invalidate(1, processingInProgress = false);

    		if (error) {
    			// TODO: Display error.
    			console.error("Error while encoding gif.", error);

    			return;
    		}

    		if (values.length < 1) {
    			// TODO: Display error.
    			console.error("Error while encoding gif.", new Error("No values passed back from picturesToAnimatedGif."));

    			return;
    		}

    		$$invalidate(0, resultGifBlob = values[0]);
    	}

    	let pictures;
    	 $$invalidate(2, pictures = []);

    	return [
    		resultGifBlob,
    		processingInProgress,
    		pictures,
    		onImagePickerChange,
    		onMakeGifClick
    	];
    }

    class Movie extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance$2, create_fragment$2, safe_not_equal, {});
    	}
    }

    var version = "1.0.11";

    /* src/App.svelte generated by Svelte v3.20.1 */

    function create_fragment$3(ctx) {
    	let main;
    	let h1;
    	let t1;
    	let div0;
    	let t3;
    	let t4;
    	let div1;
    	let t6;
    	let footer;
    	let current;
    	const movie = new Movie({});

    	return {
    		c() {
    			main = element("main");
    			h1 = element("h1");
    			h1.textContent = "Superflip!";
    			t1 = space();
    			div0 = element("div");
    			div0.textContent = "Make your animated gif here! (For free, without being tracked or hassled.)";
    			t3 = space();
    			create_component(movie.$$.fragment);
    			t4 = space();
    			div1 = element("div");
    			div1.textContent = `${version}`;
    			t6 = space();
    			footer = element("footer");

    			footer.innerHTML = `<a href="https://github.com/jimkang/super-flip-o-rama">Source.</a> Powered by <a href="https://github.com/jnordberg/gif.js">gif.js</a>.
`;

    			attr(div1, "id", "version-info");
    			attr(main, "class", "svelte-1ada6os");
    			attr(footer, "class", "svelte-1ada6os");
    		},
    		m(target, anchor) {
    			insert(target, main, anchor);
    			append(main, h1);
    			append(main, t1);
    			append(main, div0);
    			append(main, t3);
    			mount_component(movie, main, null);
    			append(main, t4);
    			append(main, div1);
    			insert(target, t6, anchor);
    			insert(target, footer, anchor);
    			current = true;
    		},
    		p: noop,
    		i(local) {
    			if (current) return;
    			transition_in(movie.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(movie.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			if (detaching) detach(main);
    			destroy_component(movie);
    			if (detaching) detach(t6);
    			if (detaching) detach(footer);
    		}
    	};
    }

    class App extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, null, create_fragment$3, safe_not_equal, {});
    	}
    }

    const app = new App({
      target: document.body,
      props: {}
    });

    return app;

}());
//# sourceMappingURL=bundle.js.map
