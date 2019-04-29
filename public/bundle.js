(function () {
	'use strict';

	function noop() {}

	function add_location(element, file, line, column, char) {
		element.__svelte_meta = {
			loc: { file, line, column, char }
		};
	}

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
		return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
	}

	function append(target, node) {
		target.appendChild(node);
	}

	function insert(target, node, anchor) {
		target.insertBefore(node, anchor);
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

	function listen(node, event, handler, options) {
		node.addEventListener(event, handler, options);
		return () => node.removeEventListener(event, handler, options);
	}

	function children(element) {
		return Array.from(element.childNodes);
	}

	function set_data(text, data) {
		data = '' + data;
		if (text.data !== data) text.data = data;
	}

	function set_style(node, key, value) {
		node.style.setProperty(key, value);
	}

	function select_option(select, value) {
		for (let i = 0; i < select.options.length; i += 1) {
			const option = select.options[i];

			if (option.__value === value) {
				option.selected = true;
				return;
			}
		}
	}

	function select_value(select) {
		const selected_option = select.querySelector(':checked') || select.options[0];
		return selected_option && selected_option.__value;
	}

	let current_component;

	function set_current_component(component) {
		current_component = component;
	}

	function get_current_component() {
		if (!current_component) throw new Error(`Function called outside component initialization`);
		return current_component;
	}

	function onMount(fn) {
		get_current_component().$$.on_mount.push(fn);
	}

	const dirty_components = [];

	const resolved_promise = Promise.resolve();
	let update_scheduled = false;
	const binding_callbacks = [];
	const render_callbacks = [];
	const flush_callbacks = [];

	function schedule_update() {
		if (!update_scheduled) {
			update_scheduled = true;
			resolved_promise.then(flush);
		}
	}

	function add_render_callback(fn) {
		render_callbacks.push(fn);
	}

	function flush() {
		const seen_callbacks = new Set();

		do {
			// first, call beforeUpdate functions
			// and update components
			while (dirty_components.length) {
				const component = dirty_components.shift();
				set_current_component(component);
				update(component.$$);
			}

			while (binding_callbacks.length) binding_callbacks.shift()();

			// then, once components are updated, call
			// afterUpdate functions. This may cause
			// subsequent updates...
			while (render_callbacks.length) {
				const callback = render_callbacks.pop();
				if (!seen_callbacks.has(callback)) {
					callback();

					// ...so guard against infinite loops
					seen_callbacks.add(callback);
				}
			}
		} while (dirty_components.length);

		while (flush_callbacks.length) {
			flush_callbacks.pop()();
		}

		update_scheduled = false;
	}

	function update($$) {
		if ($$.fragment) {
			$$.update($$.dirty);
			run_all($$.before_render);
			$$.fragment.p($$.dirty, $$.ctx);
			$$.dirty = null;

			$$.after_render.forEach(add_render_callback);
		}
	}

	function mount_component(component, target, anchor) {
		const { fragment, on_mount, on_destroy, after_render } = component.$$;

		fragment.m(target, anchor);

		// onMount happens after the initial afterUpdate. Because
		// afterUpdate callbacks happen in reverse order (inner first)
		// we schedule onMount callbacks before afterUpdate callbacks
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

		after_render.forEach(add_render_callback);
	}

	function destroy(component, detaching) {
		if (component.$$) {
			run_all(component.$$.on_destroy);
			component.$$.fragment.d(detaching);

			// TODO null out other refs, including component.$$ (but need to
			// preserve final state?)
			component.$$.on_destroy = component.$$.fragment = null;
			component.$$.ctx = {};
		}
	}

	function make_dirty(component, key) {
		if (!component.$$.dirty) {
			dirty_components.push(component);
			schedule_update();
			component.$$.dirty = {};
		}
		component.$$.dirty[key] = true;
	}

	function init(component, options, instance, create_fragment, not_equal$$1, prop_names) {
		const parent_component = current_component;
		set_current_component(component);

		const props = options.props || {};

		const $$ = component.$$ = {
			fragment: null,
			ctx: null,

			// state
			props: prop_names,
			update: noop,
			not_equal: not_equal$$1,
			bound: blank_object(),

			// lifecycle
			on_mount: [],
			on_destroy: [],
			before_render: [],
			after_render: [],
			context: new Map(parent_component ? parent_component.$$.context : []),

			// everything else
			callbacks: blank_object(),
			dirty: null
		};

		let ready = false;

		$$.ctx = instance
			? instance(component, props, (key, value) => {
				if ($$.ctx && not_equal$$1($$.ctx[key], $$.ctx[key] = value)) {
					if ($$.bound[key]) $$.bound[key](value);
					if (ready) make_dirty(component, key);
				}
			})
			: props;

		$$.update();
		ready = true;
		run_all($$.before_render);
		$$.fragment = create_fragment($$.ctx);

		if (options.target) {
			if (options.hydrate) {
				$$.fragment.l(children(options.target));
			} else {
				$$.fragment.c();
			}

			if (options.intro && component.$$.fragment.i) component.$$.fragment.i();
			mount_component(component, options.target, options.anchor);
			flush();
		}

		set_current_component(parent_component);
	}

	class SvelteComponent {
		$destroy() {
			destroy(this, true);
			this.$destroy = noop;
		}

		$on(type, callback) {
			const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
			callbacks.push(callback);

			return () => {
				const index = callbacks.indexOf(callback);
				if (index !== -1) callbacks.splice(index, 1);
			};
		}

		$set() {
			// overridden by instance, if it has props
		}
	}

	class SvelteComponentDev extends SvelteComponent {
		constructor(options) {
			if (!options || (!options.target && !options.$$inline)) {
				throw new Error(`'target' is a required option`);
			}

			super();
		}

		$destroy() {
			super.$destroy();
			this.$destroy = () => {
				console.warn(`Component was already destroyed`); // eslint-disable-line no-console
			};
		}
	}

	var config = {
	  "title": "American Community Survey 2017",
	  "subtitle": "Select tables for Connecticut by <a href='http://ctdata.org'>Connecticut Data Collaborative</a>",
	  "footer": "Connecticut Data Collaborative is a project of InformCT, Inc.<br>&copy; 2019 Connecticut Data Collaborative",
	  "data": [
	    {
	      "name": "Median Household Income",
	      "file": "median_household_income.csv",
	      "prefix": "$",
	      "suffix": "",
	      "time1": "ACS 2008-2012",
	      "col1": "ACS2012",
	      "moe1": "ACS2012_moe",
	      "time2": "ACS 2013-2017",
	      "col2": "ACS2017",
	      "moe2": "ACS2017_moe",
	      "change": "true",
	      "positive": "true",
	      "description": "<b>The median increase in household income across all towns in Connecticut was 5.8%.</b> In 129 towns, median household income increased, most significant increases in North Canaan (+26,400, or +58%), Westbrook (+31,700, or +50%), and Southbury (+23,100, or +34%). Note that North Canaan and Westbrook both have large margins of errors due to small populations. In 40 towns, median household income decreased compared to 2008-2012 estimate, with the highest decreases occurring in Ansonia (~ -$9,200, or nearly -17%), New London (~ –$6,800, or -15%), and East Haddam (~ $13,000, or -14%). <b>Hartford remains the town with the lowest median household income in Connecticut</b> despite a 17% increase in median household income between ACS 2008-2012 and 2013-2017 estimates. New Haven median income increased 1.8% and changing its rank from 2nd to 3rd poorest municipality, while New London dropped from 7th to 2nd due to a 15% decrease."
	    },
	    {
	      "name": "Per Capita Income",
	      "file": "per_capita_income.csv",
	      "prefix": "$",
	      "suffix": "",
	      "time1": "ACS 2008-2012",
	      "col1": "ACS2012",
	      "moe1": "ACS2012_moe",
	      "time2": "ACS 2013-2017",
	      "col2": "ACS2017",
	      "moe2": "ACS2017_moe",
	      "change": "true",
	      "description": "Per capita income increased in 142 municipalities and decreased in 27. <b>Hartford has the lowest per capita income at $19,220</b>, followed by Windham ($19,666), Waterbury ($21,605), Mansfield ($21,916), and Bridgeport ($22,806). New Canaan, Darien, and Westport are the towns with highest per capita income, all above $100,000."
	    }
	  ]
	};

	// # [Jenks natural breaks optimization](http://en.wikipedia.org/wiki/Jenks_natural_breaks_optimization)

	var commonjsGlobal = typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {};

	function createCommonjsModule(fn, module) {
		return module = { exports: {} }, fn(module, module.exports), module.exports;
	}

	var papaparse_min = createCommonjsModule(function (module, exports) {
	/* @license
	Papa Parse
	v5.0.0-beta.0
	https://github.com/mholt/PapaParse
	License: MIT
	*/
	!function(e,t){module.exports=t();}(commonjsGlobal,function s(){var f="undefined"!=typeof self?self:"undefined"!=typeof window?window:void 0!==f?f:{};var n=!f.document&&!!f.postMessage,o=n&&/blob:/i.test((f.location||{}).protocol),a={},h=0,k={parse:function(e,t){var r=(t=t||{}).dynamicTyping||!1;M(r)&&(t.dynamicTypingFunction=r,r={});if(t.dynamicTyping=r,t.transform=!!M(t.transform)&&t.transform,t.worker&&k.WORKERS_SUPPORTED){var i=function(){if(!k.WORKERS_SUPPORTED)return !1;var e=(r=f.URL||f.webkitURL||null,i=s.toString(),k.BLOB_URL||(k.BLOB_URL=r.createObjectURL(new Blob(["(",i,")();"],{type:"text/javascript"})))),t=new f.Worker(e);var r,i;return t.onmessage=g,t.id=h++,a[t.id]=t}();return i.userStep=t.step,i.userChunk=t.chunk,i.userComplete=t.complete,i.userError=t.error,t.step=M(t.step),t.chunk=M(t.chunk),t.complete=M(t.complete),t.error=M(t.error),delete t.worker,void i.postMessage({input:e,config:t,workerId:i.id})}var n=null;"string"==typeof e?n=t.download?new l(t):new p(t):!0===e.readable&&M(e.read)&&M(e.on)?n=new _(t):(f.File&&e instanceof File||e instanceof Object)&&(n=new c(t));return n.stream(e)},unparse:function(e,t){var i=!1,g=!0,m=",",v="\r\n",n='"',r=!1;!function(){if("object"!=typeof t)return;"string"!=typeof t.delimiter||k.BAD_DELIMITERS.filter(function(e){return -1!==t.delimiter.indexOf(e)}).length||(m=t.delimiter);("boolean"==typeof t.quotes||Array.isArray(t.quotes))&&(i=t.quotes);"boolean"!=typeof t.skipEmptyLines&&"string"!=typeof t.skipEmptyLines||(r=t.skipEmptyLines);"string"==typeof t.newline&&(v=t.newline);"string"==typeof t.quoteChar&&(n=t.quoteChar);"boolean"==typeof t.header&&(g=t.header);}();var s=new RegExp(n,"g");"string"==typeof e&&(e=JSON.parse(e));if(Array.isArray(e)){if(!e.length||Array.isArray(e[0]))return o(null,e,r);if("object"==typeof e[0])return o(a(e[0]),e,r)}else if("object"==typeof e)return "string"==typeof e.data&&(e.data=JSON.parse(e.data)),Array.isArray(e.data)&&(e.fields||(e.fields=e.meta&&e.meta.fields),e.fields||(e.fields=Array.isArray(e.data[0])?e.fields:a(e.data[0])),Array.isArray(e.data[0])||"object"==typeof e.data[0]||(e.data=[e.data])),o(e.fields||[],e.data||[],r);throw new Error("Unable to serialize unrecognized input");function a(e){if("object"!=typeof e)return [];var t=[];for(var r in e)t.push(r);return t}function o(e,t,r){var i="";"string"==typeof e&&(e=JSON.parse(e)),"string"==typeof t&&(t=JSON.parse(t));var n=Array.isArray(e)&&0<e.length,s=!Array.isArray(t[0]);if(n&&g){for(var a=0;a<e.length;a++)0<a&&(i+=m),i+=y(e[a],a);0<t.length&&(i+=v);}for(var o=0;o<t.length;o++){var h=n?e.length:t[o].length,u=!1,f=n?0===Object.keys(t[o]).length:0===t[o].length;if(r&&!n&&(u="greedy"===r?""===t[o].join("").trim():1===t[o].length&&0===t[o][0].length),"greedy"===r&&n){for(var d=[],l=0;l<h;l++){var c=s?e[l]:l;d.push(t[o][c]);}u=""===d.join("").trim();}if(!u){for(var p=0;p<h;p++){0<p&&!f&&(i+=m);var _=n&&s?e[p]:p;i+=y(t[o][_],p);}o<t.length-1&&(!r||0<h&&!f)&&(i+=v);}}return i}function y(e,t){if(null==e)return "";if(e.constructor===Date)return JSON.stringify(e).slice(1,25);e=e.toString().replace(s,n+n);var r="boolean"==typeof i&&i||Array.isArray(i)&&i[t]||function(e,t){for(var r=0;r<t.length;r++)if(-1<e.indexOf(t[r]))return !0;return !1}(e,k.BAD_DELIMITERS)||-1<e.indexOf(m)||" "===e.charAt(0)||" "===e.charAt(e.length-1);return r?n+e+n:e}}};if(k.RECORD_SEP=String.fromCharCode(30),k.UNIT_SEP=String.fromCharCode(31),k.BYTE_ORDER_MARK="\ufeff",k.BAD_DELIMITERS=["\r","\n",'"',k.BYTE_ORDER_MARK],k.WORKERS_SUPPORTED=!n&&!!f.Worker,k.NODE_STREAM_INPUT=1,k.LocalChunkSize=10485760,k.RemoteChunkSize=5242880,k.DefaultDelimiter=",",k.Parser=b,k.ParserHandle=r,k.NetworkStreamer=l,k.FileStreamer=c,k.StringStreamer=p,k.ReadableStreamStreamer=_,f.jQuery){var d=f.jQuery;d.fn.parse=function(o){var r=o.config||{},h=[];return this.each(function(e){if(!("INPUT"===d(this).prop("tagName").toUpperCase()&&"file"===d(this).attr("type").toLowerCase()&&f.FileReader)||!this.files||0===this.files.length)return !0;for(var t=0;t<this.files.length;t++)h.push({file:this.files[t],inputElem:this,instanceConfig:d.extend({},r)});}),e(),this;function e(){if(0!==h.length){var e,t,r,i,n=h[0];if(M(o.before)){var s=o.before(n.file,n.inputElem);if("object"==typeof s){if("abort"===s.action)return e="AbortError",t=n.file,r=n.inputElem,i=s.reason,void(M(o.error)&&o.error({name:e},t,r,i));if("skip"===s.action)return void u();"object"==typeof s.config&&(n.instanceConfig=d.extend(n.instanceConfig,s.config));}else if("skip"===s)return void u()}var a=n.instanceConfig.complete;n.instanceConfig.complete=function(e){M(a)&&a(e,n.file,n.inputElem),u();},k.parse(n.file,n.instanceConfig);}else M(o.complete)&&o.complete();}function u(){h.splice(0,1),e();}};}function u(e){this._handle=null,this._finished=!1,this._completed=!1,this._input=null,this._baseIndex=0,this._partialLine="",this._rowCount=0,this._start=0,this._nextChunk=null,this.isFirstChunk=!0,this._completeResults={data:[],errors:[],meta:{}},function(e){var t=E(e);t.chunkSize=parseInt(t.chunkSize),e.step||e.chunk||(t.chunkSize=null);this._handle=new r(t),(this._handle.streamer=this)._config=t;}.call(this,e),this.parseChunk=function(e,t){if(this.isFirstChunk&&M(this._config.beforeFirstChunk)){var r=this._config.beforeFirstChunk(e);void 0!==r&&(e=r);}this.isFirstChunk=!1;var i=this._partialLine+e;this._partialLine="";var n=this._handle.parse(i,this._baseIndex,!this._finished);if(!this._handle.paused()&&!this._handle.aborted()){var s=n.meta.cursor;this._finished||(this._partialLine=i.substring(s-this._baseIndex),this._baseIndex=s),n&&n.data&&(this._rowCount+=n.data.length);var a=this._finished||this._config.preview&&this._rowCount>=this._config.preview;if(o)f.postMessage({results:n,workerId:k.WORKER_ID,finished:a});else if(M(this._config.chunk)&&!t){if(this._config.chunk(n,this._handle),this._handle.paused()||this._handle.aborted())return;n=void 0,this._completeResults=void 0;}return this._config.step||this._config.chunk||(this._completeResults.data=this._completeResults.data.concat(n.data),this._completeResults.errors=this._completeResults.errors.concat(n.errors),this._completeResults.meta=n.meta),this._completed||!a||!M(this._config.complete)||n&&n.meta.aborted||(this._config.complete(this._completeResults,this._input),this._completed=!0),a||n&&n.meta.paused||this._nextChunk(),n}},this._sendError=function(e){M(this._config.error)?this._config.error(e):o&&this._config.error&&f.postMessage({workerId:k.WORKER_ID,error:e,finished:!1});};}function l(e){var i;(e=e||{}).chunkSize||(e.chunkSize=k.RemoteChunkSize),u.call(this,e),this._nextChunk=n?function(){this._readChunk(),this._chunkLoaded();}:function(){this._readChunk();},this.stream=function(e){this._input=e,this._nextChunk();},this._readChunk=function(){if(this._finished)this._chunkLoaded();else{if(i=new XMLHttpRequest,this._config.withCredentials&&(i.withCredentials=this._config.withCredentials),n||(i.onload=w(this._chunkLoaded,this),i.onerror=w(this._chunkError,this)),i.open("GET",this._input,!n),this._config.downloadRequestHeaders){var e=this._config.downloadRequestHeaders;for(var t in e)i.setRequestHeader(t,e[t]);}if(this._config.chunkSize){var r=this._start+this._config.chunkSize-1;i.setRequestHeader("Range","bytes="+this._start+"-"+r);}try{i.send();}catch(e){this._chunkError(e.message);}n&&0===i.status?this._chunkError():this._start+=this._config.chunkSize;}},this._chunkLoaded=function(){4===i.readyState&&(i.status<200||400<=i.status?this._chunkError():(this._finished=!this._config.chunkSize||this._start>function(e){var t=e.getResponseHeader("Content-Range");if(null===t)return -1;return parseInt(t.substr(t.lastIndexOf("/")+1))}(i),this.parseChunk(i.responseText)));},this._chunkError=function(e){var t=i.statusText||e;this._sendError(new Error(t));};}function c(e){var i,n;(e=e||{}).chunkSize||(e.chunkSize=k.LocalChunkSize),u.call(this,e);var s="undefined"!=typeof FileReader;this.stream=function(e){this._input=e,n=e.slice||e.webkitSlice||e.mozSlice,s?((i=new FileReader).onload=w(this._chunkLoaded,this),i.onerror=w(this._chunkError,this)):i=new FileReaderSync,this._nextChunk();},this._nextChunk=function(){this._finished||this._config.preview&&!(this._rowCount<this._config.preview)||this._readChunk();},this._readChunk=function(){var e=this._input;if(this._config.chunkSize){var t=Math.min(this._start+this._config.chunkSize,this._input.size);e=n.call(e,this._start,t);}var r=i.readAsText(e,this._config.encoding);s||this._chunkLoaded({target:{result:r}});},this._chunkLoaded=function(e){this._start+=this._config.chunkSize,this._finished=!this._config.chunkSize||this._start>=this._input.size,this.parseChunk(e.target.result);},this._chunkError=function(){this._sendError(i.error);};}function p(e){var r;u.call(this,e=e||{}),this.stream=function(e){return r=e,this._nextChunk()},this._nextChunk=function(){if(!this._finished){var e=this._config.chunkSize,t=e?r.substr(0,e):r;return r=e?r.substr(e):"",this._finished=!r,this.parseChunk(t)}};}function _(e){u.call(this,e=e||{});var t=[],r=!0,i=!1;this.pause=function(){u.prototype.pause.apply(this,arguments),this._input.pause();},this.resume=function(){u.prototype.resume.apply(this,arguments),this._input.resume();},this.stream=function(e){this._input=e,this._input.on("data",this._streamData),this._input.on("end",this._streamEnd),this._input.on("error",this._streamError);},this._checkIsFinished=function(){i&&1===t.length&&(this._finished=!0);},this._nextChunk=function(){this._checkIsFinished(),t.length?this.parseChunk(t.shift()):r=!0;},this._streamData=w(function(e){try{t.push("string"==typeof e?e:e.toString(this._config.encoding)),r&&(r=!1,this._checkIsFinished(),this.parseChunk(t.shift()));}catch(e){this._streamError(e);}},this),this._streamError=w(function(e){this._streamCleanUp(),this._sendError(e);},this),this._streamEnd=w(function(){this._streamCleanUp(),i=!0,this._streamData("");},this),this._streamCleanUp=w(function(){this._input.removeListener("data",this._streamData),this._input.removeListener("end",this._streamEnd),this._input.removeListener("error",this._streamError);},this);}function r(g){var a,o,h,i=/^\s*-?(\d*\.?\d+|\d+\.?\d*)(e[-+]?\d+)?\s*$/i,n=/(\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d:[0-5]\d\.\d+([+-][0-2]\d:[0-5]\d|Z))|(\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d:[0-5]\d([+-][0-2]\d:[0-5]\d|Z))|(\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d([+-][0-2]\d:[0-5]\d|Z))/,t=this,r=0,s=0,u=!1,e=!1,f=[],d={data:[],errors:[],meta:{}};if(M(g.step)){var l=g.step;g.step=function(e){if(d=e,p())c();else{if(c(),0===d.data.length)return;r+=e.data.length,g.preview&&r>g.preview?o.abort():l(d,t);}};}function m(e){return "greedy"===g.skipEmptyLines?""===e.join("").trim():1===e.length&&0===e[0].length}function c(){if(d&&h&&(v("Delimiter","UndetectableDelimiter","Unable to auto-detect delimiting character; defaulted to '"+k.DefaultDelimiter+"'"),h=!1),g.skipEmptyLines)for(var e=0;e<d.data.length;e++)m(d.data[e])&&d.data.splice(e--,1);return p()&&function(){if(!d)return;for(var e=0;p()&&e<d.data.length;e++)for(var t=0;t<d.data[e].length;t++){var r=d.data[e][t];M(g.transformHeader)&&(r=g.transformHeader(r)),f.push(r);}d.data.splice(0,1);}(),function(){if(!d||!g.header&&!g.dynamicTyping&&!g.transform)return d;for(var e=0;e<d.data.length;e++){var t,r=g.header?{}:[];for(t=0;t<d.data[e].length;t++){var i=t,n=d.data[e][t];g.header&&(i=t>=f.length?"__parsed_extra":f[t]),g.transform&&(n=g.transform(n,i)),n=_(i,n),"__parsed_extra"===i?(r[i]=r[i]||[],r[i].push(n)):r[i]=n;}d.data[e]=r,g.header&&(t>f.length?v("FieldMismatch","TooManyFields","Too many fields: expected "+f.length+" fields but parsed "+t,s+e):t<f.length&&v("FieldMismatch","TooFewFields","Too few fields: expected "+f.length+" fields but parsed "+t,s+e));}g.header&&d.meta&&(d.meta.fields=f);return s+=d.data.length,d}()}function p(){return g.header&&0===f.length}function _(e,t){return r=e,g.dynamicTypingFunction&&void 0===g.dynamicTyping[r]&&(g.dynamicTyping[r]=g.dynamicTypingFunction(r)),!0===(g.dynamicTyping[r]||g.dynamicTyping)?"true"===t||"TRUE"===t||"false"!==t&&"FALSE"!==t&&(i.test(t)?parseFloat(t):n.test(t)?new Date(t):""===t?null:t):t;var r;}function v(e,t,r,i){d.errors.push({type:e,code:t,message:r,row:i});}this.parse=function(e,t,r){var i=g.quoteChar||'"';if(g.newline||(g.newline=function(e,t){e=e.substr(0,1048576);var r=new RegExp(y(t)+"([^]*?)"+y(t),"gm"),i=(e=e.replace(r,"")).split("\r"),n=e.split("\n"),s=1<n.length&&n[0].length<i[0].length;if(1===i.length||s)return "\n";for(var a=0,o=0;o<i.length;o++)"\n"===i[o][0]&&a++;return a>=i.length/2?"\r\n":"\r"}(e,i)),h=!1,g.delimiter)M(g.delimiter)&&(g.delimiter=g.delimiter(e),d.meta.delimiter=g.delimiter);else{var n=function(e,t,r,i){for(var n,s,a,o=[",","\t","|",";",k.RECORD_SEP,k.UNIT_SEP],h=0;h<o.length;h++){var u=o[h],f=0,d=0,l=0;a=void 0;for(var c=new b({comments:i,delimiter:u,newline:t,preview:10}).parse(e),p=0;p<c.data.length;p++)if(r&&m(c.data[p]))l++;else{var _=c.data[p].length;d+=_,void 0!==a?1<_&&(f+=Math.abs(_-a),a=_):a=_;}0<c.data.length&&(d/=c.data.length-l),(void 0===s||f<s)&&1.99<d&&(s=f,n=u);}return {successful:!!(g.delimiter=n),bestDelimiter:n}}(e,g.newline,g.skipEmptyLines,g.comments);n.successful?g.delimiter=n.bestDelimiter:(h=!0,g.delimiter=k.DefaultDelimiter),d.meta.delimiter=g.delimiter;}var s=E(g);return g.preview&&g.header&&s.preview++,a=e,o=new b(s),d=o.parse(a,t,r),c(),u?{meta:{paused:!0}}:d||{meta:{paused:!1}}},this.paused=function(){return u},this.pause=function(){u=!0,o.abort(),a=a.substr(o.getCharIndex());},this.resume=function(){u=!1,t.streamer.parseChunk(a,!0);},this.aborted=function(){return e},this.abort=function(){e=!0,o.abort(),d.meta.aborted=!0,M(g.complete)&&g.complete(d),a="";};}function y(e){return e.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}function b(e){var S,O=(e=e||{}).delimiter,x=e.newline,I=e.comments,D=e.step,T=e.preview,L=e.fastMode,A=S=void 0===e.quoteChar?'"':e.quoteChar;if(void 0!==e.escapeChar&&(A=e.escapeChar),("string"!=typeof O||-1<k.BAD_DELIMITERS.indexOf(O))&&(O=","),I===O)throw new Error("Comment character same as delimiter");!0===I?I="#":("string"!=typeof I||-1<k.BAD_DELIMITERS.indexOf(I))&&(I=!1),"\n"!==x&&"\r"!==x&&"\r\n"!==x&&(x="\n");var F=0,z=!1;this.parse=function(i,r,t){if("string"!=typeof i)throw new Error("Input must be a string");var n=i.length,e=O.length,s=x.length,a=I.length,o=M(D),h=[],u=[],f=[],d=F=0;if(!i)return C();if(L||!1!==L&&-1===i.indexOf(S)){for(var l=i.split(x),c=0;c<l.length;c++){if(f=l[c],F+=f.length,c!==l.length-1)F+=x.length;else if(t)return C();if(!I||f.substr(0,a)!==I){if(o){if(h=[],k(f.split(O)),R(),z)return C()}else k(f.split(O));if(T&&T<=c)return h=h.slice(0,T),C(!0)}}return C()}for(var p,_=i.indexOf(O,F),g=i.indexOf(x,F),m=new RegExp(A.replace(/[-[\]/{}()*+?.\\^$|]/g,"\\$&")+S,"g");;)if(i[F]!==S)if(I&&0===f.length&&i.substr(F,a)===I){if(-1===g)return C();F=g+s,g=i.indexOf(x,F),_=i.indexOf(O,F);}else if(-1!==_&&(_<g||-1===g))f.push(i.substring(F,_)),F=_+e,_=i.indexOf(O,F);else{if(-1===g)break;if(f.push(i.substring(F,g)),w(g+s),o&&(R(),z))return C();if(T&&h.length>=T)return C(!0)}else for(p=F,F++;;){if(-1===(p=i.indexOf(S,p+1)))return t||u.push({type:"Quotes",code:"MissingQuotes",message:"Quoted field unterminated",row:h.length,index:F}),E();if(p===n-1)return E(i.substring(F,p).replace(m,S));if(S!==A||i[p+1]!==A){if(S===A||0===p||i[p-1]!==A){var v=b(-1===g?_:Math.min(_,g));if(i[p+1+v]===O){f.push(i.substring(F,p).replace(m,S)),F=p+1+v+e,_=i.indexOf(O,F),g=i.indexOf(x,F);break}var y=b(g);if(i.substr(p+1+y,s)===x){if(f.push(i.substring(F,p).replace(m,S)),w(p+1+y+s),_=i.indexOf(O,F),o&&(R(),z))return C();if(T&&h.length>=T)return C(!0);break}u.push({type:"Quotes",code:"InvalidQuotes",message:"Trailing quote on quoted field is malformed",row:h.length,index:F}),p++;}}else p++;}return E();function k(e){h.push(e),d=F;}function b(e){var t=0;if(-1!==e){var r=i.substring(p+1,e);r&&""===r.trim()&&(t=r.length);}return t}function E(e){return t||(void 0===e&&(e=i.substr(F)),f.push(e),F=n,k(f),o&&R()),C()}function w(e){F=e,k(f),f=[],g=i.indexOf(x,F);}function C(e,t){return {data:t||!1?h[0]:h,errors:u,meta:{delimiter:O,linebreak:x,aborted:z,truncated:!!e,cursor:d+(r||0)}}}function R(){D(C(void 0,!0)),h=[],u=[];}},this.abort=function(){z=!0;},this.getCharIndex=function(){return F};}function g(e){var t=e.data,r=a[t.workerId],i=!1;if(t.error)r.userError(t.error,t.file);else if(t.results&&t.results.data){var n={abort:function(){i=!0,m(t.workerId,{data:[],errors:[],meta:{aborted:!0}});},pause:v,resume:v};if(M(r.userStep)){for(var s=0;s<t.results.data.length&&(r.userStep({data:[t.results.data[s]],errors:t.results.errors,meta:t.results.meta},n),!i);s++);delete t.results;}else M(r.userChunk)&&(r.userChunk(t.results,n,t.file),delete t.results);}t.finished&&!i&&m(t.workerId,t.results);}function m(e,t){var r=a[e];M(r.userComplete)&&r.userComplete(t),r.terminate(),delete a[e];}function v(){throw new Error("Not implemented.")}function E(e){if("object"!=typeof e||null===e)return e;var t=Array.isArray(e)?[]:{};for(var r in e)t[r]=E(e[r]);return t}function w(e,t){return function(){e.apply(t,arguments);}}function M(e){return "function"==typeof e}return o&&(f.onmessage=function(e){var t=e.data;void 0===k.WORKER_ID&&t&&(k.WORKER_ID=t.workerId);if("string"==typeof t.input)f.postMessage({workerId:k.WORKER_ID,results:k.parse(t.input,t.config),finished:!0});else if(f.File&&t.input instanceof File||t.input instanceof Object){var r=k.parse(t.input,t.config);r&&f.postMessage({workerId:k.WORKER_ID,results:r,finished:!0});}}),(l.prototype=Object.create(u.prototype)).constructor=l,(c.prototype=Object.create(u.prototype)).constructor=c,(p.prototype=Object.create(p.prototype)).constructor=p,(_.prototype=Object.create(u.prototype)).constructor=_,k});
	});

	/* src/Map.svelte generated by Svelte v3.1.0 */

	const file_1 = "src/Map.svelte";

	function create_fragment(ctx) {
		var p, t0, t1, div;

		return {
			c: function create() {
				p = element("p");
				t0 = text(ctx.time);
				t1 = space();
				div = element("div");
				p.className = "f5 tc";
				add_location(p, file_1, 61, 0, 1044);
				div.id = ctx.id;
				div.className = "w-100 h-100";
				add_location(div, file_1, 63, 0, 1073);
			},

			l: function claim(nodes) {
				throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
			},

			m: function mount(target, anchor) {
				insert(target, p, anchor);
				append(p, t0);
				insert(target, t1, anchor);
				insert(target, div, anchor);
			},

			p: function update(changed, ctx) {
				if (changed.time) {
					set_data(t0, ctx.time);
				}

				if (changed.id) {
					div.id = ctx.id;
				}
			},

			i: noop,
			o: noop,

			d: function destroy(detaching) {
				if (detaching) {
					detach(p);
					detach(t1);
					detach(div);
				}
			}
		};
	}

	function instance($$self, $$props, $$invalidate) {
		let { time, id, censusTracts, file } = $$props;

		let data;

		papaparse_min.parse(file, {
			download: true,
			complete: function(d) {
				$$invalidate('data', data = d);
			}
		});

		onMount(async () => {
			var map = L.map(id, {
				center: [41.33, -72.65],
				zoom: 8,
				zoomControl: false,
				scrollWheelZoom: false,
				attributionControl: false,
			});
			map.keyboard.disable();
			map.doubleClickZoom.disable();

			fetch('./geo/towns.geojson').then(response => {
			  response.json().then(json => {
			    let geojson = json;

					let geojsonLayer = L.geoJson(geojson, {
						//style: geojsonVisible,
						//onEachFeature: onEachFeature,
					}).addTo(map);

			  });
			});

		});

		$$self.$set = $$props => {
			if ('time' in $$props) $$invalidate('time', time = $$props.time);
			if ('id' in $$props) $$invalidate('id', id = $$props.id);
			if ('censusTracts' in $$props) $$invalidate('censusTracts', censusTracts = $$props.censusTracts);
			if ('file' in $$props) $$invalidate('file', file = $$props.file);
		};

		return { time, id, censusTracts, file };
	}

	class Map$1 extends SvelteComponentDev {
		constructor(options) {
			super(options);
			init(this, options, instance, create_fragment, safe_not_equal, ["time", "id", "censusTracts", "file"]);

			const { ctx } = this.$$;
			const props = options.props || {};
			if (ctx.time === undefined && !('time' in props)) {
				console.warn("<Map> was created without expected prop 'time'");
			}
			if (ctx.id === undefined && !('id' in props)) {
				console.warn("<Map> was created without expected prop 'id'");
			}
			if (ctx.censusTracts === undefined && !('censusTracts' in props)) {
				console.warn("<Map> was created without expected prop 'censusTracts'");
			}
			if (ctx.file === undefined && !('file' in props)) {
				console.warn("<Map> was created without expected prop 'file'");
			}
		}

		get time() {
			throw new Error("<Map>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set time(value) {
			throw new Error("<Map>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		get id() {
			throw new Error("<Map>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set id(value) {
			throw new Error("<Map>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		get censusTracts() {
			throw new Error("<Map>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set censusTracts(value) {
			throw new Error("<Map>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		get file() {
			throw new Error("<Map>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set file(value) {
			throw new Error("<Map>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}
	}

	/* src/App.svelte generated by Svelte v3.1.0 */

	const file = "src/App.svelte";

	function get_each_context(ctx, list, i) {
		const child_ctx = Object.create(ctx);
		child_ctx.dp = list[i];
		child_ctx.i = i;
		return child_ctx;
	}

	// (23:2) {#each config.data as dp, i}
	function create_each_block(ctx) {
		var option, t_value = ctx.dp.name, t;

		return {
			c: function create() {
				option = element("option");
				t = text(t_value);
				option.__value = ctx.i;
				option.value = option.__value;
				add_location(option, file, 23, 3, 519);
			},

			m: function mount(target, anchor) {
				insert(target, option, anchor);
				append(option, t);
			},

			p: noop,

			d: function destroy(detaching) {
				if (detaching) {
					detach(option);
				}
			}
		};
	}

	function create_fragment$1(ctx) {
		var div0, p0, raw0_value = config.title, t0, p1, raw1_value = config.subtitle, t1, select, t2, p2, t3, a, t4, t5, t6, p3, t7, div2, div1, t8, footer, raw3_value = config.footer, current, dispose;

		var each_value = config.data;

		var each_blocks = [];

		for (var i = 0; i < each_value.length; i += 1) {
			each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
		}

		var map = new Map$1({
			props: {
			id: "map-time1",
			time: ctx.time1,
			file: ctx.downloadPath,
			censusTracts: censusTracts
		},
			$$inline: true
		});

		return {
			c: function create() {
				div0 = element("div");
				p0 = element("p");
				t0 = space();
				p1 = element("p");
				t1 = space();
				select = element("select");

				for (var i = 0; i < each_blocks.length; i += 1) {
					each_blocks[i].c();
				}

				t2 = space();
				p2 = element("p");
				t3 = text("Double-click on the map for zoom. ");
				a = element("a");
				t4 = text("Download dataset");
				t5 = text(" powering this visualization.");
				t6 = space();
				p3 = element("p");
				t7 = space();
				div2 = element("div");
				div1 = element("div");
				map.$$.fragment.c();
				t8 = space();
				footer = element("footer");
				p0.className = "f3 f2-ns mb0";
				add_location(p0, file, 18, 1, 335);
				p1.className = "f5 f3-ns mt1";
				add_location(p1, file, 19, 1, 385);
				if (ctx.currentIndex === void 0) add_render_callback(() => ctx.select_change_handler.call(select));
				select.className = "f6";
				add_location(select, file, 21, 1, 439);
				a.href = ctx.downloadPath;
				a.className = "link dim";
				add_location(a, file, 28, 36, 639);
				p2.className = "black-80 f6";
				add_location(p2, file, 27, 1, 579);
				add_location(p3, file, 31, 1, 739);
				div0.className = "mw9 center ph3";
				add_location(div0, file, 17, 0, 305);
				div1.className = "fl w-50 h-100";
				add_location(div1, file, 38, 1, 833);
				div2.className = "mw9 center ph3";
				set_style(div2, "height", "600px");
				add_location(div2, file, 37, 0, 780);
				footer.className = "w-100 center tc ph3 f6 mt5 pv5 black-80 bg-lightest-blue";
				add_location(footer, file, 53, 0, 1070);
				dispose = listen(select, "change", ctx.select_change_handler);
			},

			l: function claim(nodes) {
				throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
			},

			m: function mount(target, anchor) {
				insert(target, div0, anchor);
				append(div0, p0);
				p0.innerHTML = raw0_value;
				append(div0, t0);
				append(div0, p1);
				p1.innerHTML = raw1_value;
				append(div0, t1);
				append(div0, select);

				for (var i = 0; i < each_blocks.length; i += 1) {
					each_blocks[i].m(select, null);
				}

				select_option(select, ctx.currentIndex);

				append(div0, t2);
				append(div0, p2);
				append(p2, t3);
				append(p2, a);
				append(a, t4);
				append(p2, t5);
				append(div0, t6);
				append(div0, p3);
				p3.innerHTML = ctx.description;
				insert(target, t7, anchor);
				insert(target, div2, anchor);
				append(div2, div1);
				mount_component(map, div1, null);
				insert(target, t8, anchor);
				insert(target, footer, anchor);
				footer.innerHTML = raw3_value;
				current = true;
			},

			p: function update(changed, ctx) {
				if (changed.config) {
					each_value = config.data;

					for (var i = 0; i < each_value.length; i += 1) {
						const child_ctx = get_each_context(ctx, each_value, i);

						if (each_blocks[i]) {
							each_blocks[i].p(changed, child_ctx);
						} else {
							each_blocks[i] = create_each_block(child_ctx);
							each_blocks[i].c();
							each_blocks[i].m(select, null);
						}
					}

					for (; i < each_blocks.length; i += 1) {
						each_blocks[i].d(1);
					}
					each_blocks.length = each_value.length;
				}

				if (changed.currentIndex) select_option(select, ctx.currentIndex);

				if (!current || changed.downloadPath) {
					a.href = ctx.downloadPath;
				}

				if (!current || changed.description) {
					p3.innerHTML = ctx.description;
				}

				var map_changes = {};
				if (changed.time1) map_changes.time = ctx.time1;
				if (changed.downloadPath) map_changes.file = ctx.downloadPath;
				if (changed.censusTracts) map_changes.censusTracts = censusTracts;
				map.$set(map_changes);
			},

			i: function intro(local) {
				if (current) return;
				map.$$.fragment.i(local);

				current = true;
			},

			o: function outro(local) {
				map.$$.fragment.o(local);
				current = false;
			},

			d: function destroy(detaching) {
				if (detaching) {
					detach(div0);
				}

				destroy_each(each_blocks, detaching);

				if (detaching) {
					detach(t7);
					detach(div2);
				}

				map.$destroy();

				if (detaching) {
					detach(t8);
					detach(footer);
				}

				dispose();
			}
		};
	}

	let censusTracts = false;

	function instance$1($$self, $$props, $$invalidate) {
		


		let currentIndex = 0;

		function select_change_handler() {
			currentIndex = select_value(this);
			$$invalidate('currentIndex', currentIndex);
		}

		let dp, downloadPath, description, time1, time2;
		$$self.$$.update = ($$dirty = { currentIndex: 1, dp: 1 }) => {
			if ($$dirty.currentIndex) { $$invalidate('dp', dp = config.data[parseInt(currentIndex)]); }
			if ($$dirty.dp) { $$invalidate('downloadPath', downloadPath = 'data/' + dp.file); }
			if ($$dirty.dp) { $$invalidate('description', description = dp.description); }
			if ($$dirty.dp) { $$invalidate('time1', time1 = dp.time1); }
			if ($$dirty.dp) { $$invalidate('time2', time2 = dp.time2); }
		};

		return {
			currentIndex,
			downloadPath,
			description,
			time1,
			select_change_handler
		};
	}

	class App extends SvelteComponentDev {
		constructor(options) {
			super(options);
			init(this, options, instance$1, create_fragment$1, safe_not_equal, []);
		}
	}

	var app = new App({
		target: document.body
	});

}());
//# sourceMappingURL=bundle.js.map
