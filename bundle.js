(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
(function (process){
/*!
 * async
 * https://github.com/caolan/async
 *
 * Copyright 2010-2014 Caolan McMahon
 * Released under the MIT license
 */
/*jshint onevar: false, indent:4 */
/*global setImmediate: false, setTimeout: false, console: false */
(function () {

    var async = {};

    // global on the server, window in the browser
    var root, previous_async;

    root = this;
    if (root != null) {
      previous_async = root.async;
    }

    async.noConflict = function () {
        root.async = previous_async;
        return async;
    };

    function only_once(fn) {
        var called = false;
        return function() {
            if (called) throw new Error("Callback was already called.");
            called = true;
            fn.apply(root, arguments);
        }
    }

    //// cross-browser compatiblity functions ////

    var _toString = Object.prototype.toString;

    var _isArray = Array.isArray || function (obj) {
        return _toString.call(obj) === '[object Array]';
    };

    var _each = function (arr, iterator) {
        if (arr.forEach) {
            return arr.forEach(iterator);
        }
        for (var i = 0; i < arr.length; i += 1) {
            iterator(arr[i], i, arr);
        }
    };

    var _map = function (arr, iterator) {
        if (arr.map) {
            return arr.map(iterator);
        }
        var results = [];
        _each(arr, function (x, i, a) {
            results.push(iterator(x, i, a));
        });
        return results;
    };

    var _reduce = function (arr, iterator, memo) {
        if (arr.reduce) {
            return arr.reduce(iterator, memo);
        }
        _each(arr, function (x, i, a) {
            memo = iterator(memo, x, i, a);
        });
        return memo;
    };

    var _keys = function (obj) {
        if (Object.keys) {
            return Object.keys(obj);
        }
        var keys = [];
        for (var k in obj) {
            if (obj.hasOwnProperty(k)) {
                keys.push(k);
            }
        }
        return keys;
    };

    //// exported async module functions ////

    //// nextTick implementation with browser-compatible fallback ////
    if (typeof process === 'undefined' || !(process.nextTick)) {
        if (typeof setImmediate === 'function') {
            async.nextTick = function (fn) {
                // not a direct alias for IE10 compatibility
                setImmediate(fn);
            };
            async.setImmediate = async.nextTick;
        }
        else {
            async.nextTick = function (fn) {
                setTimeout(fn, 0);
            };
            async.setImmediate = async.nextTick;
        }
    }
    else {
        async.nextTick = process.nextTick;
        if (typeof setImmediate !== 'undefined') {
            async.setImmediate = function (fn) {
              // not a direct alias for IE10 compatibility
              setImmediate(fn);
            };
        }
        else {
            async.setImmediate = async.nextTick;
        }
    }

    async.each = function (arr, iterator, callback) {
        callback = callback || function () {};
        if (!arr.length) {
            return callback();
        }
        var completed = 0;
        _each(arr, function (x) {
            iterator(x, only_once(done) );
        });
        function done(err) {
          if (err) {
              callback(err);
              callback = function () {};
          }
          else {
              completed += 1;
              if (completed >= arr.length) {
                  callback();
              }
          }
        }
    };
    async.forEach = async.each;

    async.eachSeries = function (arr, iterator, callback) {
        callback = callback || function () {};
        if (!arr.length) {
            return callback();
        }
        var completed = 0;
        var iterate = function () {
            iterator(arr[completed], function (err) {
                if (err) {
                    callback(err);
                    callback = function () {};
                }
                else {
                    completed += 1;
                    if (completed >= arr.length) {
                        callback();
                    }
                    else {
                        iterate();
                    }
                }
            });
        };
        iterate();
    };
    async.forEachSeries = async.eachSeries;

    async.eachLimit = function (arr, limit, iterator, callback) {
        var fn = _eachLimit(limit);
        fn.apply(null, [arr, iterator, callback]);
    };
    async.forEachLimit = async.eachLimit;

    var _eachLimit = function (limit) {

        return function (arr, iterator, callback) {
            callback = callback || function () {};
            if (!arr.length || limit <= 0) {
                return callback();
            }
            var completed = 0;
            var started = 0;
            var running = 0;

            (function replenish () {
                if (completed >= arr.length) {
                    return callback();
                }

                while (running < limit && started < arr.length) {
                    started += 1;
                    running += 1;
                    iterator(arr[started - 1], function (err) {
                        if (err) {
                            callback(err);
                            callback = function () {};
                        }
                        else {
                            completed += 1;
                            running -= 1;
                            if (completed >= arr.length) {
                                callback();
                            }
                            else {
                                replenish();
                            }
                        }
                    });
                }
            })();
        };
    };


    var doParallel = function (fn) {
        return function () {
            var args = Array.prototype.slice.call(arguments);
            return fn.apply(null, [async.each].concat(args));
        };
    };
    var doParallelLimit = function(limit, fn) {
        return function () {
            var args = Array.prototype.slice.call(arguments);
            return fn.apply(null, [_eachLimit(limit)].concat(args));
        };
    };
    var doSeries = function (fn) {
        return function () {
            var args = Array.prototype.slice.call(arguments);
            return fn.apply(null, [async.eachSeries].concat(args));
        };
    };


    var _asyncMap = function (eachfn, arr, iterator, callback) {
        arr = _map(arr, function (x, i) {
            return {index: i, value: x};
        });
        if (!callback) {
            eachfn(arr, function (x, callback) {
                iterator(x.value, function (err) {
                    callback(err);
                });
            });
        } else {
            var results = [];
            eachfn(arr, function (x, callback) {
                iterator(x.value, function (err, v) {
                    results[x.index] = v;
                    callback(err);
                });
            }, function (err) {
                callback(err, results);
            });
        }
    };
    async.map = doParallel(_asyncMap);
    async.mapSeries = doSeries(_asyncMap);
    async.mapLimit = function (arr, limit, iterator, callback) {
        return _mapLimit(limit)(arr, iterator, callback);
    };

    var _mapLimit = function(limit) {
        return doParallelLimit(limit, _asyncMap);
    };

    // reduce only has a series version, as doing reduce in parallel won't
    // work in many situations.
    async.reduce = function (arr, memo, iterator, callback) {
        async.eachSeries(arr, function (x, callback) {
            iterator(memo, x, function (err, v) {
                memo = v;
                callback(err);
            });
        }, function (err) {
            callback(err, memo);
        });
    };
    // inject alias
    async.inject = async.reduce;
    // foldl alias
    async.foldl = async.reduce;

    async.reduceRight = function (arr, memo, iterator, callback) {
        var reversed = _map(arr, function (x) {
            return x;
        }).reverse();
        async.reduce(reversed, memo, iterator, callback);
    };
    // foldr alias
    async.foldr = async.reduceRight;

    var _filter = function (eachfn, arr, iterator, callback) {
        var results = [];
        arr = _map(arr, function (x, i) {
            return {index: i, value: x};
        });
        eachfn(arr, function (x, callback) {
            iterator(x.value, function (v) {
                if (v) {
                    results.push(x);
                }
                callback();
            });
        }, function (err) {
            callback(_map(results.sort(function (a, b) {
                return a.index - b.index;
            }), function (x) {
                return x.value;
            }));
        });
    };
    async.filter = doParallel(_filter);
    async.filterSeries = doSeries(_filter);
    // select alias
    async.select = async.filter;
    async.selectSeries = async.filterSeries;

    var _reject = function (eachfn, arr, iterator, callback) {
        var results = [];
        arr = _map(arr, function (x, i) {
            return {index: i, value: x};
        });
        eachfn(arr, function (x, callback) {
            iterator(x.value, function (v) {
                if (!v) {
                    results.push(x);
                }
                callback();
            });
        }, function (err) {
            callback(_map(results.sort(function (a, b) {
                return a.index - b.index;
            }), function (x) {
                return x.value;
            }));
        });
    };
    async.reject = doParallel(_reject);
    async.rejectSeries = doSeries(_reject);

    var _detect = function (eachfn, arr, iterator, main_callback) {
        eachfn(arr, function (x, callback) {
            iterator(x, function (result) {
                if (result) {
                    main_callback(x);
                    main_callback = function () {};
                }
                else {
                    callback();
                }
            });
        }, function (err) {
            main_callback();
        });
    };
    async.detect = doParallel(_detect);
    async.detectSeries = doSeries(_detect);

    async.some = function (arr, iterator, main_callback) {
        async.each(arr, function (x, callback) {
            iterator(x, function (v) {
                if (v) {
                    main_callback(true);
                    main_callback = function () {};
                }
                callback();
            });
        }, function (err) {
            main_callback(false);
        });
    };
    // any alias
    async.any = async.some;

    async.every = function (arr, iterator, main_callback) {
        async.each(arr, function (x, callback) {
            iterator(x, function (v) {
                if (!v) {
                    main_callback(false);
                    main_callback = function () {};
                }
                callback();
            });
        }, function (err) {
            main_callback(true);
        });
    };
    // all alias
    async.all = async.every;

    async.sortBy = function (arr, iterator, callback) {
        async.map(arr, function (x, callback) {
            iterator(x, function (err, criteria) {
                if (err) {
                    callback(err);
                }
                else {
                    callback(null, {value: x, criteria: criteria});
                }
            });
        }, function (err, results) {
            if (err) {
                return callback(err);
            }
            else {
                var fn = function (left, right) {
                    var a = left.criteria, b = right.criteria;
                    return a < b ? -1 : a > b ? 1 : 0;
                };
                callback(null, _map(results.sort(fn), function (x) {
                    return x.value;
                }));
            }
        });
    };

    async.auto = function (tasks, callback) {
        callback = callback || function () {};
        var keys = _keys(tasks);
        var remainingTasks = keys.length
        if (!remainingTasks) {
            return callback();
        }

        var results = {};

        var listeners = [];
        var addListener = function (fn) {
            listeners.unshift(fn);
        };
        var removeListener = function (fn) {
            for (var i = 0; i < listeners.length; i += 1) {
                if (listeners[i] === fn) {
                    listeners.splice(i, 1);
                    return;
                }
            }
        };
        var taskComplete = function () {
            remainingTasks--
            _each(listeners.slice(0), function (fn) {
                fn();
            });
        };

        addListener(function () {
            if (!remainingTasks) {
                var theCallback = callback;
                // prevent final callback from calling itself if it errors
                callback = function () {};

                theCallback(null, results);
            }
        });

        _each(keys, function (k) {
            var task = _isArray(tasks[k]) ? tasks[k]: [tasks[k]];
            var taskCallback = function (err) {
                var args = Array.prototype.slice.call(arguments, 1);
                if (args.length <= 1) {
                    args = args[0];
                }
                if (err) {
                    var safeResults = {};
                    _each(_keys(results), function(rkey) {
                        safeResults[rkey] = results[rkey];
                    });
                    safeResults[k] = args;
                    callback(err, safeResults);
                    // stop subsequent errors hitting callback multiple times
                    callback = function () {};
                }
                else {
                    results[k] = args;
                    async.setImmediate(taskComplete);
                }
            };
            var requires = task.slice(0, Math.abs(task.length - 1)) || [];
            var ready = function () {
                return _reduce(requires, function (a, x) {
                    return (a && results.hasOwnProperty(x));
                }, true) && !results.hasOwnProperty(k);
            };
            if (ready()) {
                task[task.length - 1](taskCallback, results);
            }
            else {
                var listener = function () {
                    if (ready()) {
                        removeListener(listener);
                        task[task.length - 1](taskCallback, results);
                    }
                };
                addListener(listener);
            }
        });
    };

    async.retry = function(times, task, callback) {
        var DEFAULT_TIMES = 5;
        var attempts = [];
        // Use defaults if times not passed
        if (typeof times === 'function') {
            callback = task;
            task = times;
            times = DEFAULT_TIMES;
        }
        // Make sure times is a number
        times = parseInt(times, 10) || DEFAULT_TIMES;
        var wrappedTask = function(wrappedCallback, wrappedResults) {
            var retryAttempt = function(task, finalAttempt) {
                return function(seriesCallback) {
                    task(function(err, result){
                        seriesCallback(!err || finalAttempt, {err: err, result: result});
                    }, wrappedResults);
                };
            };
            while (times) {
                attempts.push(retryAttempt(task, !(times-=1)));
            }
            async.series(attempts, function(done, data){
                data = data[data.length - 1];
                (wrappedCallback || callback)(data.err, data.result);
            });
        }
        // If a callback is passed, run this as a controll flow
        return callback ? wrappedTask() : wrappedTask
    };

    async.waterfall = function (tasks, callback) {
        callback = callback || function () {};
        if (!_isArray(tasks)) {
          var err = new Error('First argument to waterfall must be an array of functions');
          return callback(err);
        }
        if (!tasks.length) {
            return callback();
        }
        var wrapIterator = function (iterator) {
            return function (err) {
                if (err) {
                    callback.apply(null, arguments);
                    callback = function () {};
                }
                else {
                    var args = Array.prototype.slice.call(arguments, 1);
                    var next = iterator.next();
                    if (next) {
                        args.push(wrapIterator(next));
                    }
                    else {
                        args.push(callback);
                    }
                    async.setImmediate(function () {
                        iterator.apply(null, args);
                    });
                }
            };
        };
        wrapIterator(async.iterator(tasks))();
    };

    var _parallel = function(eachfn, tasks, callback) {
        callback = callback || function () {};
        if (_isArray(tasks)) {
            eachfn.map(tasks, function (fn, callback) {
                if (fn) {
                    fn(function (err) {
                        var args = Array.prototype.slice.call(arguments, 1);
                        if (args.length <= 1) {
                            args = args[0];
                        }
                        callback.call(null, err, args);
                    });
                }
            }, callback);
        }
        else {
            var results = {};
            eachfn.each(_keys(tasks), function (k, callback) {
                tasks[k](function (err) {
                    var args = Array.prototype.slice.call(arguments, 1);
                    if (args.length <= 1) {
                        args = args[0];
                    }
                    results[k] = args;
                    callback(err);
                });
            }, function (err) {
                callback(err, results);
            });
        }
    };

    async.parallel = function (tasks, callback) {
        _parallel({ map: async.map, each: async.each }, tasks, callback);
    };

    async.parallelLimit = function(tasks, limit, callback) {
        _parallel({ map: _mapLimit(limit), each: _eachLimit(limit) }, tasks, callback);
    };

    async.series = function (tasks, callback) {
        callback = callback || function () {};
        if (_isArray(tasks)) {
            async.mapSeries(tasks, function (fn, callback) {
                if (fn) {
                    fn(function (err) {
                        var args = Array.prototype.slice.call(arguments, 1);
                        if (args.length <= 1) {
                            args = args[0];
                        }
                        callback.call(null, err, args);
                    });
                }
            }, callback);
        }
        else {
            var results = {};
            async.eachSeries(_keys(tasks), function (k, callback) {
                tasks[k](function (err) {
                    var args = Array.prototype.slice.call(arguments, 1);
                    if (args.length <= 1) {
                        args = args[0];
                    }
                    results[k] = args;
                    callback(err);
                });
            }, function (err) {
                callback(err, results);
            });
        }
    };

    async.iterator = function (tasks) {
        var makeCallback = function (index) {
            var fn = function () {
                if (tasks.length) {
                    tasks[index].apply(null, arguments);
                }
                return fn.next();
            };
            fn.next = function () {
                return (index < tasks.length - 1) ? makeCallback(index + 1): null;
            };
            return fn;
        };
        return makeCallback(0);
    };

    async.apply = function (fn) {
        var args = Array.prototype.slice.call(arguments, 1);
        return function () {
            return fn.apply(
                null, args.concat(Array.prototype.slice.call(arguments))
            );
        };
    };

    var _concat = function (eachfn, arr, fn, callback) {
        var r = [];
        eachfn(arr, function (x, cb) {
            fn(x, function (err, y) {
                r = r.concat(y || []);
                cb(err);
            });
        }, function (err) {
            callback(err, r);
        });
    };
    async.concat = doParallel(_concat);
    async.concatSeries = doSeries(_concat);

    async.whilst = function (test, iterator, callback) {
        if (test()) {
            iterator(function (err) {
                if (err) {
                    return callback(err);
                }
                async.whilst(test, iterator, callback);
            });
        }
        else {
            callback();
        }
    };

    async.doWhilst = function (iterator, test, callback) {
        iterator(function (err) {
            if (err) {
                return callback(err);
            }
            var args = Array.prototype.slice.call(arguments, 1);
            if (test.apply(null, args)) {
                async.doWhilst(iterator, test, callback);
            }
            else {
                callback();
            }
        });
    };

    async.until = function (test, iterator, callback) {
        if (!test()) {
            iterator(function (err) {
                if (err) {
                    return callback(err);
                }
                async.until(test, iterator, callback);
            });
        }
        else {
            callback();
        }
    };

    async.doUntil = function (iterator, test, callback) {
        iterator(function (err) {
            if (err) {
                return callback(err);
            }
            var args = Array.prototype.slice.call(arguments, 1);
            if (!test.apply(null, args)) {
                async.doUntil(iterator, test, callback);
            }
            else {
                callback();
            }
        });
    };

    async.queue = function (worker, concurrency) {
        if (concurrency === undefined) {
            concurrency = 1;
        }
        function _insert(q, data, pos, callback) {
          if (!q.started){
            q.started = true;
          }
          if (!_isArray(data)) {
              data = [data];
          }
          if(data.length == 0) {
             // call drain immediately if there are no tasks
             return async.setImmediate(function() {
                 if (q.drain) {
                     q.drain();
                 }
             });
          }
          _each(data, function(task) {
              var item = {
                  data: task,
                  callback: typeof callback === 'function' ? callback : null
              };

              if (pos) {
                q.tasks.unshift(item);
              } else {
                q.tasks.push(item);
              }

              if (q.saturated && q.tasks.length === q.concurrency) {
                  q.saturated();
              }
              async.setImmediate(q.process);
          });
        }

        var workers = 0;
        var q = {
            tasks: [],
            concurrency: concurrency,
            saturated: null,
            empty: null,
            drain: null,
            started: false,
            paused: false,
            push: function (data, callback) {
              _insert(q, data, false, callback);
            },
            kill: function () {
              q.drain = null;
              q.tasks = [];
            },
            unshift: function (data, callback) {
              _insert(q, data, true, callback);
            },
            process: function () {
                if (!q.paused && workers < q.concurrency && q.tasks.length) {
                    var task = q.tasks.shift();
                    if (q.empty && q.tasks.length === 0) {
                        q.empty();
                    }
                    workers += 1;
                    var next = function () {
                        workers -= 1;
                        if (task.callback) {
                            task.callback.apply(task, arguments);
                        }
                        if (q.drain && q.tasks.length + workers === 0) {
                            q.drain();
                        }
                        q.process();
                    };
                    var cb = only_once(next);
                    worker(task.data, cb);
                }
            },
            length: function () {
                return q.tasks.length;
            },
            running: function () {
                return workers;
            },
            idle: function() {
                return q.tasks.length + workers === 0;
            },
            pause: function () {
                if (q.paused === true) { return; }
                q.paused = true;
                q.process();
            },
            resume: function () {
                if (q.paused === false) { return; }
                q.paused = false;
                q.process();
            }
        };
        return q;
    };
    
    async.priorityQueue = function (worker, concurrency) {
        
        function _compareTasks(a, b){
          return a.priority - b.priority;
        };
        
        function _binarySearch(sequence, item, compare) {
          var beg = -1,
              end = sequence.length - 1;
          while (beg < end) {
            var mid = beg + ((end - beg + 1) >>> 1);
            if (compare(item, sequence[mid]) >= 0) {
              beg = mid;
            } else {
              end = mid - 1;
            }
          }
          return beg;
        }
        
        function _insert(q, data, priority, callback) {
          if (!q.started){
            q.started = true;
          }
          if (!_isArray(data)) {
              data = [data];
          }
          if(data.length == 0) {
             // call drain immediately if there are no tasks
             return async.setImmediate(function() {
                 if (q.drain) {
                     q.drain();
                 }
             });
          }
          _each(data, function(task) {
              var item = {
                  data: task,
                  priority: priority,
                  callback: typeof callback === 'function' ? callback : null
              };
              
              q.tasks.splice(_binarySearch(q.tasks, item, _compareTasks) + 1, 0, item);

              if (q.saturated && q.tasks.length === q.concurrency) {
                  q.saturated();
              }
              async.setImmediate(q.process);
          });
        }
        
        // Start with a normal queue
        var q = async.queue(worker, concurrency);
        
        // Override push to accept second parameter representing priority
        q.push = function (data, priority, callback) {
          _insert(q, data, priority, callback);
        };
        
        // Remove unshift function
        delete q.unshift;

        return q;
    };

    async.cargo = function (worker, payload) {
        var working     = false,
            tasks       = [];

        var cargo = {
            tasks: tasks,
            payload: payload,
            saturated: null,
            empty: null,
            drain: null,
            drained: true,
            push: function (data, callback) {
                if (!_isArray(data)) {
                    data = [data];
                }
                _each(data, function(task) {
                    tasks.push({
                        data: task,
                        callback: typeof callback === 'function' ? callback : null
                    });
                    cargo.drained = false;
                    if (cargo.saturated && tasks.length === payload) {
                        cargo.saturated();
                    }
                });
                async.setImmediate(cargo.process);
            },
            process: function process() {
                if (working) return;
                if (tasks.length === 0) {
                    if(cargo.drain && !cargo.drained) cargo.drain();
                    cargo.drained = true;
                    return;
                }

                var ts = typeof payload === 'number'
                            ? tasks.splice(0, payload)
                            : tasks.splice(0, tasks.length);

                var ds = _map(ts, function (task) {
                    return task.data;
                });

                if(cargo.empty) cargo.empty();
                working = true;
                worker(ds, function () {
                    working = false;

                    var args = arguments;
                    _each(ts, function (data) {
                        if (data.callback) {
                            data.callback.apply(null, args);
                        }
                    });

                    process();
                });
            },
            length: function () {
                return tasks.length;
            },
            running: function () {
                return working;
            }
        };
        return cargo;
    };

    var _console_fn = function (name) {
        return function (fn) {
            var args = Array.prototype.slice.call(arguments, 1);
            fn.apply(null, args.concat([function (err) {
                var args = Array.prototype.slice.call(arguments, 1);
                if (typeof console !== 'undefined') {
                    if (err) {
                        if (console.error) {
                            console.error(err);
                        }
                    }
                    else if (console[name]) {
                        _each(args, function (x) {
                            console[name](x);
                        });
                    }
                }
            }]));
        };
    };
    async.log = _console_fn('log');
    async.dir = _console_fn('dir');
    /*async.info = _console_fn('info');
    async.warn = _console_fn('warn');
    async.error = _console_fn('error');*/

    async.memoize = function (fn, hasher) {
        var memo = {};
        var queues = {};
        hasher = hasher || function (x) {
            return x;
        };
        var memoized = function () {
            var args = Array.prototype.slice.call(arguments);
            var callback = args.pop();
            var key = hasher.apply(null, args);
            if (key in memo) {
                async.nextTick(function () {
                    callback.apply(null, memo[key]);
                });
            }
            else if (key in queues) {
                queues[key].push(callback);
            }
            else {
                queues[key] = [callback];
                fn.apply(null, args.concat([function () {
                    memo[key] = arguments;
                    var q = queues[key];
                    delete queues[key];
                    for (var i = 0, l = q.length; i < l; i++) {
                      q[i].apply(null, arguments);
                    }
                }]));
            }
        };
        memoized.memo = memo;
        memoized.unmemoized = fn;
        return memoized;
    };

    async.unmemoize = function (fn) {
      return function () {
        return (fn.unmemoized || fn).apply(null, arguments);
      };
    };

    async.times = function (count, iterator, callback) {
        var counter = [];
        for (var i = 0; i < count; i++) {
            counter.push(i);
        }
        return async.map(counter, iterator, callback);
    };

    async.timesSeries = function (count, iterator, callback) {
        var counter = [];
        for (var i = 0; i < count; i++) {
            counter.push(i);
        }
        return async.mapSeries(counter, iterator, callback);
    };

    async.seq = function (/* functions... */) {
        var fns = arguments;
        return function () {
            var that = this;
            var args = Array.prototype.slice.call(arguments);
            var callback = args.pop();
            async.reduce(fns, args, function (newargs, fn, cb) {
                fn.apply(that, newargs.concat([function () {
                    var err = arguments[0];
                    var nextargs = Array.prototype.slice.call(arguments, 1);
                    cb(err, nextargs);
                }]))
            },
            function (err, results) {
                callback.apply(that, [err].concat(results));
            });
        };
    };

    async.compose = function (/* functions... */) {
      return async.seq.apply(null, Array.prototype.reverse.call(arguments));
    };

    var _applyEach = function (eachfn, fns /*args...*/) {
        var go = function () {
            var that = this;
            var args = Array.prototype.slice.call(arguments);
            var callback = args.pop();
            return eachfn(fns, function (fn, cb) {
                fn.apply(that, args.concat([cb]));
            },
            callback);
        };
        if (arguments.length > 2) {
            var args = Array.prototype.slice.call(arguments, 2);
            return go.apply(this, args);
        }
        else {
            return go;
        }
    };
    async.applyEach = doParallel(_applyEach);
    async.applyEachSeries = doSeries(_applyEach);

    async.forever = function (fn, callback) {
        function next(err) {
            if (err) {
                if (callback) {
                    return callback(err);
                }
                throw err;
            }
            fn(next);
        }
        next();
    };

    // Node.js
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = async;
    }
    // AMD / RequireJS
    else if (typeof define !== 'undefined' && define.amd) {
        define([], function () {
            return async;
        });
    }
    // included directly via <script> tag
    else {
        root.async = async;
    }

}());

}).call(this,require('_process'))
},{"_process":11}],2:[function(require,module,exports){
(function (Buffer){
"use strict";

function SerialPort(path, options, openImmediately) {
	console.log("SerialPort constructed.");

	this.comName = path;

	if (options) {
		for (var key in this.options) {
			//console.log("Looking for " + key + " option.");
			if (options[key] != undefined) {
				//console.log("Replacing " + key + " with " + options[key]);
				this.options[key] = options[key];
			}
		}
	}

	if (typeof chrome != "undefined" && chrome.serial) {
		var self = this;

		if (openImmediately != false) {
			this.open();
		}

	} else {
		throw "No access to serial ports. Try loading as a Chrome Application.";
	}
}

SerialPort.prototype.options = {
    baudrate: 57600,
    buffersize: 1
};

SerialPort.prototype.connectionId = -1;

SerialPort.prototype.comName = "";

SerialPort.prototype.eventListeners = {};

SerialPort.prototype.open = function (callback) {
	console.log("Opening ", this.comName);
	chrome.serial.connect(this.comName, {bitrate: parseInt(this.options.baudrate)}, this.proxy('onOpen', callback));
};

SerialPort.prototype.onOpen = function (callback, openInfo) {
	console.log("onOpen", callback, openInfo);
	this.connectionId = openInfo.connectionId;
	if (this.connectionId == -1) {
		this.publishEvent("error", "Could not open port.");
		return;
	}

	this.publishEvent("open", openInfo);


	console.log('Connected to port.', this.connectionId);

	typeof callback == "function" && callback(null, openInfo);

	chrome.serial.onReceive.addListener(this.proxy('onRead'));

};

SerialPort.prototype.onRead = function (readInfo) {
	if (readInfo && this.connectionId == readInfo.connectionId) {

		var uint8View = new Uint8Array(readInfo.data);
		var string = "";
		for (var i = 0; i < readInfo.data.byteLength; i++) {
			string += String.fromCharCode(uint8View[i]);
		}

		//console.log("Got data", string, readInfo.data);

		this.publishEvent("data", toBuffer(uint8View));
		this.publishEvent("dataString", string);
	}
}

SerialPort.prototype.write = function (buffer, callback) {
	if (typeof callback != "function") { callback = function() {}; }

	//Make sure its not a browserify faux Buffer.
	if (buffer instanceof ArrayBuffer == false) {
		buffer = buffer2ArrayBuffer(buffer);
	}

	chrome.serial.send(this.connectionId, buffer, callback);
};

SerialPort.prototype.writeString = function (string, callback) {
	this.write(str2ab(string), callback);
};

SerialPort.prototype.close = function (callback) {
	chrome.serial.disconnect(this.connectionId, this.proxy('onClose', callback));
};

SerialPort.prototype.onClose = function (callback) {
	this.connectionId = -1;
	console.log("Closed port", arguments);
	this.publishEvent("close");
	typeof callback == "function" && callback(null);
};

SerialPort.prototype.flush = function (callback) {

};

//Expecting: data, error
SerialPort.prototype.on = function (eventName, callback) {
	if (this.eventListeners[eventName] == undefined) {
		this.eventListeners[eventName] = [];
	}
	if (typeof callback == "function") {
		this.eventListeners[eventName].push(callback);
	} else {
		throw "can not subscribe with a non function callback";
	}
}

SerialPort.prototype.publishEvent = function (eventName, data) {
	if (this.eventListeners[eventName] != undefined) {
		for (var i = 0; i < this.eventListeners[eventName].length; i++) {
			this.eventListeners[eventName][i](data);
		}
	}
}

SerialPort.prototype.proxy = function () {
	var self = this;
	var proxyArgs = [];

	//arguments isnt actually an array.
	for (var i = 0; i < arguments.length; i++) {
	    proxyArgs[i] = arguments[i];
	}

	var functionName = proxyArgs.splice(0, 1)[0];

	var func = function() {
		var funcArgs = [];
		for (var i = 0; i < arguments.length; i++) {
		    funcArgs[i] = arguments[i];
		}
		var allArgs = proxyArgs.concat(funcArgs);

		self[functionName].apply(self, allArgs);
	}

	return func;
}

SerialPort.prototype.set = function (options, callback) {
	console.log("Setting ", options);
	chrome.serial.setControlSignals(this.connectionId, options, function(result){
		if(result) callback();
		else callback(result);
	});
};

function SerialPortList(callback) {
	if (typeof chrome != "undefined" && chrome.serial) {
		chrome.serial.getDevices(function(ports) {
			var portObjects = Array(ports.length);
			for (var i = 0; i < ports.length; i++) {
				portObjects[i] = new SerialPort(ports[i].path, null, false);
			}
			callback(null, portObjects);
		});
	} else {
		callback("No access to serial ports. Try loading as a Chrome Application.", null);
	}
};

// Convert string to ArrayBuffer
function str2ab(str) {
	var buf = new ArrayBuffer(str.length);
	var bufView = new Uint8Array(buf);
	for (var i = 0; i < str.length; i++) {
		bufView[i] = str.charCodeAt(i);
	}
	return buf;
}

// Convert buffer to ArrayBuffer
function buffer2ArrayBuffer(buffer) {
	var buf = new ArrayBuffer(buffer.length);
	var bufView = new Uint8Array(buf);
	for (var i = 0; i < buffer.length; i++) {
		bufView[i] = buffer[i];
	}
	return buf;
}

function toBuffer(ab) {
	var buffer = new Buffer(ab.byteLength);
	var view = new Uint8Array(ab);
	for (var i = 0; i < buffer.length; ++i) {
	    buffer[i] = view[i];
	}
	return buffer;
}

module.exports = {
	SerialPort: SerialPort,
	list: SerialPortList,
	used: [] //TODO: Populate this somewhere.
};

}).call(this,require("buffer").Buffer)
},{"buffer":7}],3:[function(require,module,exports){
(function (Buffer){
//Intel Hex record types
const DATA = 0,
	END_OF_FILE = 1,
	EXT_SEGMENT_ADDR = 2,
	START_SEGMENT_ADDR = 3,
	EXT_LINEAR_ADDR = 4,
	START_LINEAR_ADDR = 5;

const EMPTY_VALUE = 0xFF;

/* intel_hex.parse(data)
	`data` - Intel Hex file (string in ASCII format or Buffer Object)
	`bufferSize` - the size of the Buffer containing the data (optional)
	
	returns an Object with the following properties:
		- data - data as a Buffer Object, padded with 0xFF
			where data is empty.
		- startSegmentAddress - the address provided by the last
			start segment address record; null, if not given
		- startLinearAddress - the address provided by the last
			start linear address record; null, if not given
	Special thanks to: http://en.wikipedia.org/wiki/Intel_HEX
*/
exports.parse = function parseIntelHex(data, bufferSize) {
	if(data instanceof Buffer)
		data = data.toString("ascii");
	//Initialization
	var buf = new Buffer(bufferSize || 8192),
		bufLength = 0, //Length of data in the buffer
		highAddress = 0, //upper address
		startSegmentAddress = null,
		startLinearAddress = null,
		lineNum = 0, //Line number in the Intel Hex string
		pos = 0; //Current position in the Intel Hex string
	const SMALLEST_LINE = 11;
	while(pos + SMALLEST_LINE <= data.length)
	{
		//Parse an entire line
		if(data.charAt(pos++) != ":")
			throw new Error("Line " + (lineNum+1) +
				" does not start with a colon (:).");
		else
			lineNum++;
		//Number of bytes (hex digit pairs) in the data field
		var dataLength = parseInt(data.substr(pos, 2), 16);
		pos += 2;
		//Get 16-bit address (big-endian)
		var lowAddress = parseInt(data.substr(pos, 4), 16);
		pos += 4;
		//Record type
		var recordType = parseInt(data.substr(pos, 2), 16);
		pos += 2;
		//Data field (hex-encoded string)
		var dataField = data.substr(pos, dataLength * 2),
			dataFieldBuf = new Buffer(dataField, "hex");
		pos += dataLength * 2;
		//Checksum
		var checksum = parseInt(data.substr(pos, 2), 16);
		pos += 2;
		//Validate checksum
		var calcChecksum = (dataLength + (lowAddress >> 8) +
			lowAddress + recordType) & 0xFF;
		for(var i = 0; i < dataLength; i++)
			calcChecksum = (calcChecksum + dataFieldBuf[i]) & 0xFF;
		calcChecksum = (0x100 - calcChecksum) & 0xFF;
		if(checksum != calcChecksum)
			throw new Error("Invalid checksum on line " + lineNum +
				": got " + checksum + ", but expected " + calcChecksum);
		//Parse the record based on its recordType
		switch(recordType)
		{
			case DATA:
				var absoluteAddress = highAddress + lowAddress;
				//Expand buf, if necessary
				if(absoluteAddress + dataLength >= buf.length)
				{
					var tmp = new Buffer((absoluteAddress + dataLength) * 2);
					buf.copy(tmp, 0, 0, bufLength);
					buf = tmp;
				}
				//Write over skipped bytes with EMPTY_VALUE
				if(absoluteAddress > bufLength)
					buf.fill(EMPTY_VALUE, bufLength, absoluteAddress);
				//Write the dataFieldBuf to buf
				dataFieldBuf.copy(buf, absoluteAddress);
				bufLength = Math.max(bufLength, absoluteAddress + dataLength);
				break;
			case END_OF_FILE:
				if(dataLength != 0)
					throw new Error("Invalid EOF record on line " +
						lineNum + ".");
				return {
					"data": buf.slice(0, bufLength),
					"startSegmentAddress": startSegmentAddress,
					"startLinearAddress": startLinearAddress
				};
				break;
			case EXT_SEGMENT_ADDR:
				if(dataLength != 2 || lowAddress != 0)
					throw new Error("Invalid extended segment address record on line " +
						lineNum + ".");
				highAddress = parseInt(dataField, 16) << 4;
				break;
			case START_SEGMENT_ADDR:
				if(dataLength != 4 || lowAddress != 0)
					throw new Error("Invalid start segment address record on line " +
						lineNum + ".");
				startSegmentAddress = parseInt(dataField, 16);
				break;
			case EXT_LINEAR_ADDR:
				if(dataLength != 2 || lowAddress != 0)
					throw new Error("Invalid extended linear address record on line " +
						lineNum + ".");
				highAddress = parseInt(dataField, 16) << 16;
				break;
			case START_LINEAR_ADDR:
				if(dataLength != 4 || lowAddress != 0)
					throw new Error("Invalid start linear address record on line " +
						lineNum + ".");
				startLinearAddress = parseInt(dataField, 16);
				break;
			default:
				throw new Error("Invalid record type (" + recordType +
					") on line " + lineNum);
				break;
		}
		//Advance to the next line
		if(data.charAt(pos) == "\r")
			pos++;
		if(data.charAt(pos) == "\n")
			pos++;
	}
	throw new Error("Unexpected end of input: missing or invalid EOF record.");
};
}).call(this,require("buffer").Buffer)
},{"buffer":7}],4:[function(require,module,exports){
(function (Buffer){
//use strict might have screwed up my this context, or might not have.. 
// var serialPort = require("serialport");
var async = require("async");
var bufferEqual = require('buffer-equal');

var Cmnd_STK_GET_SYNC = 0x30;
var Cmnd_STK_SET_DEVICE = 0x42;
var Cmnd_STK_ENTER_PROGMODE = 0x50;
var Cmnd_STK_LOAD_ADDRESS = 0x55;
var Cmnd_STK_PROG_PAGE = 0x64;
var Cmnd_STK_LEAVE_PROGMODE = 0x51;

var Sync_CRC_EOP = 0x20;

var Resp_STK_OK = 0x10;
var Resp_STK_INSYNC = 0x14;

var memtype = 0x46;
var timeout = 200;

//todo abstract out chrome and take serial object shim
function stk500(port) {
	// if (!(this instanceof stk500)) 
	// return new stk500();

	console.log("constructed");

	this.serialPort = port;

	this.buffer = new Buffer(300);

	this.bufferSize = 0;

};

stk500.prototype.matchReceive = function(buffer, timeout, callback){
	console.log("matching");
	console.log(buffer.toString('hex'));

	var self = this;

	var elapsed = 0;
	var interval = 10;

	var timer = setInterval(check, interval);

	function check(){
		if(elapsed>timeout){
			clearInterval(timer);
			self.buffer = new Buffer(300);
			self.bufferSize = 0;
			callback("timed out after " + elapsed + "ms");
		}
		// console.log(elapsed);
		elapsed = elapsed + interval;

		if(self.bufferSize>=buffer.length){
			console.log(bufferEqual(self.buffer.slice(0,buffer.length), buffer));
			if(bufferEqual(self.buffer.slice(0,buffer.length), buffer)){
				self.buffer = new Buffer(300);
				self.bufferSize = 0;
				clearInterval(timer);
				callback(null);
			}
			else{
				var buffer_copy = new Buffer(self.bufferSize);
				self.buffer.copy(buffer_copy);
				self.buffer = new Buffer(300);
				self.bufferSize = 0;
				clearInterval(timer);
				callback(buffer_copy);
			}
		}
	}
};

//todo use error
stk500.prototype.connect = function(done) {
	console.log("connect");

	var self = this;

	this.serialPort.open(function (error) {

	  if ( error ) {
	    console.log('failed to connect: ' + error);
	    done(error);
	  } else {
	    console.log('connected');
	    self.serialPort.on('data', function(data) {
	      console.log("received " + data.toString('hex'));
	      data.copy(self.buffer, self.bufferSize);
	      self.bufferSize = self.bufferSize + data.length;
	    });
	    done();
	  }
	});

};

//todo can this timeout? or fail?
stk500.prototype.disconnect = function(done) {
	console.log("disconnect");

	var self = this;

	self.serialPort.close(function (error) {
	  if ( error ) {
	    console.log('failed to close: ' + error);
	    done(error);
	  } else {
	    console.log('closed');
	    done();
	  }
	});

};

stk500.prototype.reset = function(delay1, delay2, done){
	console.log("reset");

	var self = this;

	async.series([
	  function(cbdone) {
	  	console.log("asserting");
	    self.serialPort.set({rts:true, dtr:true}, function(result){
	    	console.log("asserted");
	    	if(result) cbdone(result);
	    	else cbdone();
	    });
	  },
	  function(cbdone) {
	  	console.log("wait");
	    setTimeout(cbdone, delay1);
	  },
	  function(cbdone) {
	  	console.log("clearing");
	    self.serialPort.set({rts:false, dtr:false}, function(result){
	    	console.log("clear");
	    	if(result) cbdone(result);
	    	else cbdone();
	    });
	  },
	  function(cbdone) {
	  	console.log("wait");
	    setTimeout(cbdone, delay2);
	  }],
		function(error) {
			done(error);
		}
	);
};

stk500.prototype.sync = function(attempts, done) {
	console.log("sync");
	var self = this;
	var tries = 1;

	var cmd = new Buffer([Cmnd_STK_GET_SYNC, Sync_CRC_EOP]);

	attempt();
	function attempt(){
		tries=tries+1;
		console.log(cmd.toString('hex'));
		self.serialPort.write(cmd, function(error, results){
			console.log("confirm sync");
			self.matchReceive(new Buffer([Resp_STK_INSYNC, Resp_STK_OK]), timeout, function(error){
				if(error) {
					if(typeof error === Buffer){
						console.log("no match");
						done(error);
					}else if(tries<=attempts){
						console.log("failed attempt again");
						attempt();
					}else{
						console.log("failed all attempts");
						done("no response");
					}
				}else{
					console.log("confirmed sync");
					done();
				}
			});
		});
	}
};

stk500.prototype.setOptions = function(options, done) {
	console.log("set device");
	var self = this;
	var cmd = new Buffer([Cmnd_STK_SET_DEVICE, options.devicecode, options.revision, options.progtype, options.parmode, options.polling, options.selftimed, options.lockbytes, options.fusebytes, options.flashpollval1, options.flashpollval2, options.eeprompollval1, options.eeprompollval2, options.pagesizehigh, options.pagesizelow, options.eepromsizehigh, options.eepromsizelow, options.flashsize4, options.flashsize3, options.flashsize2, options.flashsize1, Sync_CRC_EOP]);
	console.log(cmd.toString('hex'));
	this.serialPort.write(cmd, function(error, results){
		console.log("confirm set device");		
			self.matchReceive(new Buffer([Resp_STK_INSYNC, Resp_STK_OK]), timeout, function(error){
				done(error);
		});
	});
};


stk500.prototype.enterProgrammingMode = function(done) {
	console.log("send enter programming mode");
	var self = this;
	var cmd = new Buffer([Cmnd_STK_ENTER_PROGMODE, Sync_CRC_EOP]);
	console.log(cmd.toString('hex'));
	this.serialPort.write(cmd, function(error, results) {
		console.log("sent enter programming mode");
		self.matchReceive(new Buffer([Resp_STK_INSYNC, Resp_STK_OK]), timeout, function(error){
	  	done(error);
		});
	});
};


stk500.prototype.loadAddress = function(useaddr, done) {
	console.log("load address");
	var self = this;

	var addr_low = useaddr & 0xff;
	var addr_high = (useaddr >> 8) & 0xff;

	var cmd = new Buffer([Cmnd_STK_LOAD_ADDRESS, addr_low, addr_high, Sync_CRC_EOP]);
	console.log(cmd.toString('hex'));

	this.serialPort.write(cmd, function(error, results) {
		console.log("confirm load address");
  	self.matchReceive(new Buffer([Resp_STK_INSYNC, Resp_STK_OK]), timeout, function(error){
  		done(error);
  	});

	});

};


stk500.prototype.loadPage = function(writeBytes, done) {
	console.log("load page");
	var self = this;

	var bytes_low = writeBytes.length & 0xff;
	var bytes_high = writeBytes.length >> 8;

	var cmd = new Buffer([Cmnd_STK_PROG_PAGE, bytes_high, bytes_low, memtype]);
	cmd = Buffer.concat([cmd,writeBytes]);
	var end = new Buffer([Sync_CRC_EOP]);
	cmd = Buffer.concat([cmd,end]);
	console.log(cmd.toString('hex'));

	this.serialPort.write(cmd, function(error, results) {
		console.log("loaded page");

		self.matchReceive(new Buffer([Resp_STK_INSYNC, Resp_STK_OK]), timeout, function(error){
			done(error);
		});

	});
};

stk500.prototype.upload = function(hex, pageSize, done) {
	console.log("program");

	var pageaddr = 0;
	var writeBytes;
	var useaddr;

	var self = this;

	// program individual pages
  async.whilst(
    function() { return pageaddr < hex.length; },
    function(pagedone) {
			console.log("program page");
      async.series([
      	function(cbdone){
      		useaddr = pageaddr >> 1;
      		cbdone();
      	},
      	function(cbdone){
      		self.loadAddress(useaddr, cbdone);
      	},
        function(cbdone){

					writeBytes = hex.slice(pageaddr, (hex.length > pageSize ? (pageaddr + pageSize) : hex.length - 1))
        	cbdone();
        },
        function(cbdone){
        	self.loadPage(writeBytes, cbdone);
        },
        function(cbdone){
					console.log("programmed page");
        	pageaddr =  pageaddr + writeBytes.length;
        	setTimeout(cbdone, 4);
        }
      ],
      function(error) {
      	console.log("page done");
      	pagedone(error);
      });
    },
    function(error) {
    	console.log("upload done");
    	done(error);
    }
  );
};

stk500.prototype.exitProgrammingMode = function(done) {
	console.log("send leave programming mode");
	var self = this;
	var cmd = new Buffer([Cmnd_STK_LEAVE_PROGMODE, Sync_CRC_EOP]);
	console.log(cmd.toString('hex'));

	this.serialPort.write(cmd, function(error, results) {
		console.log("sent leave programming mode");
		self.matchReceive(new Buffer([Resp_STK_INSYNC, Resp_STK_OK]), timeout, function(error){
			done(error);
		});
	});
};

stk500.prototype.verify = function(hex, done) {
	// console.log("verify");
	// var self = this;

	// serial.send([Cmnd_STK_LOAD_ADDRESS, addr_low, addr_high, Sync_CRC_EOP]) n times
	// self.matchReceive([Resp_STK_INSYNC, Resp_STK_OK]);
	// serial.send ([Cmnd_STK_READ_PAGE, bytes_high, bytes_low, memtype, Sync_CRC_EOP]) n times
	// self.matchReceive([Resp_STK_INSYNC].concat(writeBytes));
	done();
};

//todo convenience function
stk500.prototype.bootload = function (chip, hex, done){
	done();
};

// export the class
module.exports = stk500;
}).call(this,require("buffer").Buffer)
},{"async":1,"buffer":7,"buffer-equal":5}],5:[function(require,module,exports){
var Buffer = require('buffer').Buffer; // for use with browserify

module.exports = function (a, b) {
    if (!Buffer.isBuffer(a)) return undefined;
    if (!Buffer.isBuffer(b)) return undefined;
    if (typeof a.equals === 'function') return a.equals(b);
    if (a.length !== b.length) return false;
    
    for (var i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) return false;
    }
    
    return true;
};

},{"buffer":7}],6:[function(require,module,exports){
var SerialPort = require("browser-serialport");
var intel_hex = require('intel-hex');
var stk500 = require('stk500');
var async = require("async");

var usbttyRE = /(cu\.usb|ttyACM|COM\d+)/;

var data = ":100000000C9465000C948D000C948D000C948D0064\n:100010000C948D000C948D000C948D000C948D002C\n:100020000C948D000C948D000C948D000C94CD08D4\n:100030000C948D000C948D000C948D000C948D000C\n:100040000C94B3110C948D000C94BD130C940F14EC\n:100050000C948D000C948D000C948D000C948D00EC\n:100060000C94290B0C948D00000000002400270044\n:100070002A0000000000250028002B0000000000DE\n:1000800023002600290004040404040404040202DA\n:100090000202020203030303030301020408102007\n:1000A0004080010204081020010204081020000012\n:1000B0000007000201000003040600000000000029\n:1000C00000007401C509550E7E1511241FBECFEF27\n:1000D000D8E0DEBFCDBF11E0A0E0B1E0E0EEFDE290\n:1000E00002C005900D92A03EB107D9F714E0A0EE32\n:1000F000B1E001C01D92A636B107E1F710E0CAECED\n:10010000D0E004C02297FE010E94EA16C23CD1074B\n:10011000C9F70E94D5150C94EE160C940000FB0153\n:10012000DC014150504048F001900D920020C9F789\n:1001300001C01D9241505040E0F70895FC0181E05C\n:1001400090E00190061609F4CF010020D1F7019745\n:100150000895FB0151915523A9F0BF01DC014D9198\n:1001600045174111E1F759F4CD010190002049F004\n:100170004D9140154111C9F3FB014111EFCF81E0D1\n:1001800090E0019708950F931F93CF93DF93B82FBB\n:10019000833008F075C090E00196A82FAA0FAA0F2F\n:1001A000AA0F0197A53108F0A4E1482F440F440F8E\n:1001B000440F71E050E0C62FD0E001E010E01EC017\n:1001C000842F82508231C0F4242F30E0F901E851AD\n:1001D000FE4F8081823080F4572BF901EE0FFF1F14\n:1001E000E150FE4F11821082872F90E08C239D23D7\n:1001F000892B11F011830083770F4F5F4A1700F3AB\n:10020000BB2361F4852F8C7FF8942BB1982F9095A8\n:1002100092238623982B9BB9789432C0B13009F58C\n:10022000F89495B1852F8F7380958923962F9F73AE\n:100230009523892B85B948B1252F30E0862F90E092\n:100240002823392386E0359527958A95E1F752953D\n:1002500056955695537050955423522B58B978940F\n:100260000FC0852F8F70F89428B1982F990F990F90\n:10027000909592238623880F880F982B98B97894AD\n:10028000DF91CF911F910F910895482F863018F577\n:100290002091E0013091E101672B81F481E090E051\n:1002A00002C0880F991F4A95E2F780959095282300\n:1002B00039233093E1012093E001089581E090E03B\n:1002C00002C0880F991F4A95E2F7282B392B3093EB\n:1002D000E1012093E0010895833028F4E82FF0E055\n:1002E000EE51FE4F60830895CF93DF93CAE6D2E0CC\n:1002F000CE010E944707239682E0CE38D807C1F787\n:10030000DF91CF9108950F931F93CF93DF938B01CC\n:10031000843178F5C82FD0E0FE01E851FE4FE0812E\n:10032000E33091F0E43029F582508C30E0F49E0106\n:1003300022503040C901880F991F820F931F8659A0\n:100340009D4F0E94DF070FC0833051F0853041F090\n:10035000863031F0893021F08A3011F08B3019F479\n:10036000B8010E94C912CC0FDD1FC150DE4F1983A6\n:100370000883DF91CF911F910F910895AF92BF92A3\n:10038000DF92EF92FF920F931F93DF93CF930F9221\n:10039000CDB7DEB7D82E7B01082F10E0F801E85169\n:1003A000FE4F8081863061F480916702882341F09E\n:1003B0006630710529F0109267028FEF8093B801C3\n:1003C0009D2D925099839C30B8F4E4E0EE16F10430\n:1003D00099F0C80102975C01AA0CBB1CA80EB91EBB\n:1003E0008AE692E0A80EB91EC5010E94CD078823B7\n:1003F00019F0C5010E9461074D2D4E504630B8F4EA\n:100400002091E0013091E10192E0E916F10409F058\n:10041000E0C081E090E0042E02C0880F991F0A948A\n:10042000E2F7282B392B3093E1012093E001E98199\n:10043000E23130F5ED2DE695E695E69598012770C9\n:100440003070E114F10471F4F0E0E450FE4F81E00B\n:1004500090E002C0880F991F2A95E2F72081282B8F\n:1004600020830EC0F0E0E450FE4F81E090E002C037\n:10047000880F991F2A95E2F7809520818223808337\n:10048000F801EE0FFF1FE150FE4F11821082F2E0E3\n:10049000EF16F104E1F083E0E816F1044CF4E11406\n:1004A000F10439F191E0E916F10409F08BC032C092\n:1004B000E4E0EE16F10409F45DC0F4E0EF16F10497\n:1004C000CCF186E0E816F10409F07CC070C046303B\n:1004D00008F08CC09981923140F48D2D60E00E942B\n:1004E00029138D2D60E00E94681308511E4F82E091\n:1004F00066C0F981F23108F079C08D2D60E00E946C\n:1005000029138D2D60E00E94681308511E4FF801D9\n:1005100010826CC0F981F23108F068C08D2D60E066\n:100520000E9468138D2D61E00E94291308511E4F0F\n:1005300081E045C0F3E0DF1681F085E0D81669F070\n:1005400096E0D91651F0E9E0DE1639F0FAE0DF1650\n:1005500021F08BE0D81609F049C08D2D61E00E9492\n:1005600029138D2D60E070E00E94C91208511E4FC2\n:1005700083E025C0F981FC30C8F5F801E851FE4F51\n:1005800084E08083C80102977C01EE0CFF1CE80E1A\n:10059000F91E8AE692E0E80EF91EC7010E94CD0717\n:1005A000882321F5C701B8010E94C6081FC09EEE2E\n:1005B000D90EE1E0ED15D0F008511E4F86E0F801AC\n:1005C000808314C084E793E060E071E00E94E00E55\n:1005D0000DC081E090E0042E02C0880F991F0A949C\n:1005E000E2F780959095282339231DCF0F90CF9166\n:1005F000DF911F910F91FF90EF90DF90BF90AF9030\n:1006000008951F9380916702882329F01092670252\n:100610008FEF8093B8011092E2011092FC011092CA\n:10062000E5011092E3011092FD011092E601109293\n:10063000E4011092FE011092E70110E0812F8E502C\n:10064000863020F4812F62E070E003C0812F61E0EA\n:1006500070E00E94BE011F5F143181F71092E1012A\n:100660001092E0011F9108950F931F9304E713E088\n:10067000C80161E171E042E023E00E94DB0FC801A4\n:1006800060EE43E851E00E940F0EC80160E943ECC0\n:1006900050E00E940F0EC80160EC45E451E00E945A\n:1006A0000F0EC80160ED4CE651E00E940F0EC8012C\n:1006B00064EF4EEB51E00E940F0EC80160EF4CED6D\n:1006C00054E00E94330EC8016FEF41E053E00E94F6\n:1006D0002D0EC80140E051EE60E070E00E944A102B\n:1006E0000E9401031F910F9108951F9310E0812F25\n:1006F0008251823028F4812F66E070E00E94BE01B2\n:100700001F5F1431A1F781E0809367028AEF92E0C6\n:100710000E94650A1F9108951F93CF93DF93282F9E\n:10072000162FC82FD0E0FE01E450FE4F8081182321\n:10073000442331F4FE01EB51FE4F8081811751F0CB\n:1007400084E793E0622F412F50E00E94AA0DCB5125\n:10075000DE4F1883DF91CF911F9108958091E201C0\n:10076000882349F069B18091FC0168236C7F80E0A7\n:1007700040E00E948C038091E301882379F083B1EB\n:1007800066B16295660F660F607C8F73682B8091EF\n:10079000FD01682381E040E00E948C038091E40128\n:1007A000882379F086B190E08C7390709595879549\n:1007B000959587956091FE01682382E040E00E9454\n:1007C0008C030895EF92FF920F931F93CF93DF93C3\n:1007D000F82EEB01E42E8FEF6F3F780719F4C0E09D\n:1007E000D0E014C08AEF92E06F2D0E948B098AEF4F\n:1007F00092E06C2F0E940D0A8AEF92E00E94500A4C\n:1008000080916802909169020E9462128AEF92E0E0\n:100810006F2D4E2D0E94610A0E2D10E08AEF92E09E\n:100820000E9495090817190791F4F0924702C093A6\n:100830004802C9E4D2E00C0F1D1F05C08AEF92E008\n:100840000E949E098993C017D107C1F712C08AEF91\n:1008500092E00E949509801791072CF484E793E0B9\n:1008600065E271E004C084E793E06DE471E00E940A\n:10087000E00E82E0E80E84E793E067E74E2D27E480\n:1008800032E00E94DC0DDF91CF911F910F91FF901C\n:10089000EF900895AF92BF92CF92DF92EF92FF92C6\n:1008A0000F931F93CF93DF930E94AE0304C084E79E\n:1008B00093E00E942C0F84E793E00E94830D892B24\n:1008C000B1F70E94FB116093270270932802809376\n:1008D000290290932A02A0902B02B0902C02C09083\n:1008E0002D02D0902E022091B6013091B7017901EE\n:1008F0000027F7FC0095102F6A197B098C099D09C8\n:10090000E616F7060807190708F04BC0EA0CFB1CAF\n:100910000C1D1D1DE0922B02F0922C0200932D0263\n:1009200010932E02C8EED1E012EF1630C0F4888189\n:100930008230A9F48091E0019091E101012E02C082\n:10094000959587950A94E2F780FF09C0812F0E9450\n:10095000A712AC0184E793E0612F0E948F0D1F5F07\n:100960002196163011F78091B80187FD1AC010E06A\n:100970000EC0F901EE0FFF1FE20FF31FE15DFD4F07\n:100980006181808170E042810E94E2031F5F212F1C\n:1009900030E08091B801992787FD909582179307E1\n:1009A00044F7DF91CF911F910F91FF90EF90DF906F\n:1009B000CF90BF90AF900895BF92CF92DF92EF9209\n:1009C000FF920F931F93CF93DF93162FEA018F3679\n:1009D00009F44FC1803750F48B3609F46AC18D3663\n:1009E00009F4D3C1893609F048C228C2863769F0B4\n:1009F000873720F4803709F040C2E4C0883709F413\n:100A0000C7C08A3709F039C219C1898185FF05C07D\n:100A100084E793E064E771E054C0688188718830AE\n:100A200059F1893018F4882341F027C2803109F444\n:100A300040C0883109F021C264C08AEF92E00E9470\n:100A40008B0902E00EC0FE01E00FF11D6181679588\n:100A5000662767958081680F8AEF92E00E940D0AF1\n:100A60000E5F011780F38AEF92E00E94500A86E43D\n:100A700090E00E94621201C29B818A81163071F45B\n:100A8000979599279795980F4D81479544274795B6\n:100A90008C81480F862F692F70E008C097959927A1\n:100AA0009795980F862F6FEF7FEF492F0E94E203F3\n:100AB000E4C18091B80187303CF084E793E060EABC\n:100AC00071E00E94E00ED9C18F5F8093B801992731\n:100AD00087FD9095FC01EE0FFF1FE80FF91FE15D08\n:100AE000FD4F60838B818795882787959A81890F31\n:100AF00081838D818795882787959C81890F828343\n:100B0000BCC15091B801151634F420E0C52FDD2783\n:100B1000C7FDD09511C08FEF8093B801AEC1FC0125\n:100B2000EE0FFF1FE80FF91FE15DFD4F60836623A5\n:100B300011F0422F24C02F5F822F90E0C817D907F1\n:100B400074F740E01CC04830C8F4C9010196D901CF\n:100B5000AA0FBB1FA20FB31FA15DBD4FFC01EE0F7B\n:100B6000FF1FE80FF91FE15DFD4F80818C938081AD\n:100B700011968C931197828112968C934F5F242F3C\n:100B800030E0C217D307FCF651505093B80175C13D\n:100B90008981682F70E07695762F6627779567951F\n:100BA0008881680F711D6115710521F070936902CC\n:100BB0006093680280916702882309F05EC10E94F9\n:100BC00075035BC1653008F458C1F880C980EA80BC\n:100BD000BB80DC808F2D82508C3008F04EC10F2DF1\n:100BE00010E0C8010297EC01CC0FDD1FC80FD91F20\n:100BF000C659DD4FCE010E94CD07882319F0CE01E2\n:100C00000E9461074E2D50E05695542F442757956A\n:100C100047954C0D511D2D2D30E03695322F222752\n:100C2000379527952B0D311DCE01B8010E9447083D\n:100C30008F2D64E070E00E94BE011FC1623008F495\n:100C40001CC1898190E09695982F88279795879564\n:100C50002881820F911D9093B7018093B6010A9766\n:100C60000CF00BC18AE090E09093B7018093B6013D\n:100C700004C1623008F401C18981682F70E012302C\n:100C8000A1F08A8190E09695982F8827979587956F\n:100C9000682B792B133049F02B81922F9295990F65\n:100CA000990F907C80E0682B792B88810E948301CA\n:100CB000E4C080E494E060EF0E943E1580E494E09C\n:100CC0006CE60E943E1500E01EEF16C01231A0F443\n:100CD00080E494E060E00E943E1580E494E061E0EE\n:100CE0000E943E1580E494E061E00E943E1580E49D\n:100CF00094E061E00E943E15802F8E50863050F4C3\n:100D000080E494E062E00E943E1580E494E06AE0B2\n:100D10000E943E15033051F0053041F0063031F0AD\n:100D2000093021F00A3011F00B3051F480E494E0E6\n:100D300063E00E943E1580E494E068E00E943E1566\n:100D40001C3050F480E494E064E00E943E1580E49E\n:100D500094E06EE00E943E15802F8251823050F464\n:100D600080E494E066E00E943E1580E494E061E057\n:100D70000E943E1580E494E06FE70E943E150F5FED\n:100D80001F5F043109F0A2CF73C0662309F475C058\n:100D9000088180E494E060EF0E943E1580E494E0D6\n:100DA0006EE60E943E1580E494E0602F0E943E159E\n:100DB000043108F05DC0C02FD0E0FE01E851FE4FC5\n:100DC00080E494E060810E943E158E01000F111FA7\n:100DD00001501E4FF801608170E06F77707080E401\n:100DE00094E00E943E15F80160817181CB0180780A\n:100DF000892B59F0660F672F661F770B70E06F77AE\n:100E0000707080E494E00E943E15CC0FDD1FC1504D\n:100E1000DE4F28813981C9018070907C892B41F196\n:100E2000330F220B330F322F221F622F70E06F77A8\n:100E3000707080E494E00E943E151AC080E494E053\n:100E400060EF0E943E1580E494E06AE60E943E1541\n:100E5000C2EFDFEFC63018F06FE770E001C0BE01EF\n:100E600080E494E00E943E152196C630D10591F7AA\n:100E700080E494E067EF0E943E15DF91CF911F91CF\n:100E80000F91FF90EF90DF90CF90BF900895FC01FD\n:100E900080918E028C3090F480838F5F80938E02DD\n:100EA000815090E0FC01EE0FFF1FE80FF91FE157A2\n:100EB000FD4F88EB9BE09283818308958FEF8083C1\n:100EC0000895DC018C9190E0FC01EE0FFF1FE80F0C\n:100ED000F91FE157FD4F80818F7B80838C916CE0FF\n:100EE0000E94781690E0AC01440F551F480F591F1F\n:100EF000440F551F440F551F20E030E0C901840FF7\n:100F0000951FFC01EE0FFF1FE80FF91FE157FD4F82\n:100F1000808186FD05C02F5F3F4F2C30310571F772\n:100F20000895FC0120812C30B8F58181992787FD37\n:100F3000909548E850E0481B590B440F551F440F4B\n:100F4000551F6417750784F08281992787FD909556\n:100F500048E552E0481B590B440F551F440F551FDD\n:100F6000641775070CF4AB0142505040CA01AA2720\n:100F700097FDA095BA2F880F991FAA1FBB1F4FB7C7\n:100F8000F89430E0F901EE0FFF1FE20FF31FE15775\n:100F9000FD4F928381834FBF0895FC01808190E0D3\n:100FA000FC01EE0FFF1FE80FF91FE157FD4F808195\n:100FB000829586958695817009F081E00895AF92BB\n:100FC000BF92CF92DF92EF92FF920F931F93CF9336\n:100FD000DF93EC019B0182E0603278070CF048C09F\n:100FE00077FF03C020E030E005C0653B710514F0D9\n:100FF00024EB30E000D000D0B901882777FD809540\n:10100000982F2981332727FD3095E8E8AE2EB12CA3\n:10101000A21AB30AAA0CBB1CAA0CBB1CCC24B7FC9A\n:10102000C094DC2CEA81FF27E7FDF09528E532E04B\n:101030002E1B3F0B220F331F220F331F442737FD78\n:101040004095542FEDB7FEB72183328343835483F9\n:1010500020E030E040E050E004EBE02EF12C012DE8\n:10106000112D0E9410169B010F900F900F900F9062\n:10107000CE01B9010E949107DF91CF911F910F918D\n:10108000FF90EF90DF90CF90BF90AF900895CF92F8\n:10109000DF92EF92FF921F93CF93DF93EC01162F15\n:1010A0007A01690188818C3008F064C0862F61E084\n:1010B0000E942913888190E0FC01EE0FFF1FE80FCA\n:1010C000F91FE157FD4F1F738081807C812B808346\n:1010D00080E292E08E199F0964E070E00E9484161D\n:1010E000698380E699E08C199D0964E070E00E94B4\n:1010F00084166A83A8818A2F6CE00E947816682F74\n:1011000070E0AB01440F551F460F571F440F551F8A\n:10111000440F551F20E030E0C901840F951FFC01EA\n:10112000EE0FFF1FE80FF91FE157FD4F808186FD8D\n:1011300015C02F5F3F4F2C30310571F724C010923E\n:10114000800082E0809381001092850010928400DC\n:10115000B19A80916F00826080936F008A2F90E037\n:10116000FC01EE0FFF1FE80FF91FE157FD4F8081D3\n:10117000806480838881DF91CF911F91FF90EF90F1\n:10118000DF90CF900895672BD1F2E8CF40E252E094\n:1011900020E639E00E94470808951F920F920FB68B\n:1011A0000F9211242F933F934F935F936F937F93ED\n:1011B0008F939F93AF93BF93EF93FF938091B3026D\n:1011C00087FF05C010928500109284002BC02091EB\n:1011D000B302332727FD309580918E0290E02817C7\n:1011E000390704F58091B302992787FD9095FC019A\n:1011F000EE0FFF1FE80FF91FE157FD4F808186FFBB\n:1012000011C08091B302992787FD9095FC01EE0FE4\n:10121000FF1FE80FF91FE157FD4F80818F7360E0DA\n:101220000E9468138091B3028F5F8093B302209174\n:10123000B302332727FD309580918E0290E0281766\n:1012400039070CF04EC08091B3028C300CF049C0CD\n:1012500020918400309185008091B302992787FD09\n:101260009095FC01EE0FFF1FE80FF91FE157FD4FAE\n:1012700081819281280F391F309389002093880043\n:101280008091B302992787FD9095FC01EE0FFF1F17\n:10129000E80FF91FE157FD4F808186FF2BC0809139\n:1012A000B302992787FD9095FC01EE0FFF1FE80F11\n:1012B000F91FE157FD4F80818F7361E00E94681331\n:1012C00019C080E49CE905C080918400909185005C\n:1012D000049690938900809388008FEF8093B302E7\n:1012E00009C08091840090918500049680549C49A7\n:1012F00040F3EACFFF91EF91BF91AF919F918F9112\n:101300007F916F915F914F913F912F910F900FBE01\n:101310000F901F90189581E08093F9026093D60298\n:101320001092F7021092F80208952091D50230E051\n:101330008091D402281B3109C90108954091D4023B\n:101340008091D502481718F02FEF3FEF0AC0E42F25\n:10135000F0E0EC54FD4F8081282F30E04F5F409348\n:10136000D402C9010895E091D4028091D502E81712\n:1013700018F0EFEFFFEF06C0F0E0EC54FD4F808176\n:10138000E82FF0E0CF01089508951092FD02109229\n:10139000FC0288EE93E0A0E0B0E08093FE02909320\n:1013A000FF02A0930003B093010384EC91E09093BB\n:1013B000FB028093FA020895CF92DF92EF92FF92A0\n:1013C0000F931F93CF93DF937C016B018A01809170\n:1013D000F9028823A1F0C0E0D0E00DC0D701ED9163\n:1013E000FC91D601AC0FBD1F0190F081E02DC7012B\n:1013F0006C9109952196C017D10780F304C0CB01E9\n:10140000642F0E940E0BC801DF91CF911F910F91A5\n:10141000FF90EF90DF90CF900895DF93CF930F92DE\n:10142000CDB7DEB7FC0169838091F9028823C9F04A\n:101430008091F802803238F081E090E093838283DB\n:1014400020E030E015C08091F702E82FF0E0E9528B\n:10145000FD4F998190838F5F8093F7028093F8020C\n:1014600005C0CE01019661E00E940E0B21E030E044\n:10147000C9010F90CF91DF9108950F93062F8091AE\n:10148000D60267ED72E04091F80221E00E94B90AAD\n:101490001092F7021092F8021092F9020F9108953B\n:1014A00061E00E943D0A0895413208F040E2862F33\n:1014B00064EB72E00E94700A1092D4028093D5020D\n:1014C000089521E00E94540A08951092D4021092C7\n:1014D000D5021092F7021092F8020E94BA0C0895F9\n:1014E000382F413210F040E042C08091060388233B\n:1014F000E1F791E090930603209308038FEF809328\n:10150000730310922E03415040932F034F5F90932B\n:10151000070380910703330F832B80930703809188\n:101520000903813041F410920903809107038093ED\n:10153000BB0085EC01C085EE8093BC008091060362\n:101540008130E1F380912E03841710F440912E0333\n:1015500020E030E00AC0FB01E20FF31FD901A25FD7\n:10156000BC4F8C9180832F5F3F4F2417A0F3842FB3\n:1015700008950F931F93582F122F413210F081E0DE\n:101580004AC0809106038823E1F782E08093060336\n:10159000009308038FEF8093730310922E03409300\n:1015A0002F03AEE0B3E0FB0102C081918D938E2F3B\n:1015B000861B8417D0F31092070380910703550F01\n:1015C000852B8093070380910903813041F41092A9\n:1015D0000903809107038093BB0085EC01C085EE71\n:1015E0008093BC00112321F0809106038230E1F347\n:1015F000809173038F3F11F480E00DC080917303DD\n:10160000803211F482E007C080917303803311F0BF\n:1016100084E001C083E01F910F910895482F61324B\n:1016200010F081E0089580910603843011F082E08B\n:10163000089560935103A0E3B3E0842F9C01F90166\n:1016400002C081918D938E2F841B8617D0F380E08A\n:1016500008951F920F920FB60F9211242F933F936C\n:101660004F935F936F937F938F939F93AF93BF93AA\n:10167000EF93FF938091B90090E0887F907080365F\n:10168000910509F4F2C081369105CCF588329105B7\n:1016900009F47BC089329105B4F48031910509F4D5\n:1016A0006FC0813191053CF4009709F447C1089758\n:1016B00009F04FC165C08831910509F466C0809773\n:1016C00009F047C182C08034910509F4A4C0813477\n:1016D000910544F48033910509F482C0C89709F05C\n:1016E00038C189C08035910509F489C088359105D4\n:1016F00009F496C08834910509F02BC1AEC0883931\n:10170000910509F413C189399105ECF488379105E5\n:1017100009F4ABC0893791054CF48836910509F47A\n:10172000A4C08037910509F014C19FC08838910585\n:1017300009F4FCC08039910509F49DC080389105F9\n:1017400009F007C198C0803B910509F4C6C0813BF0\n:1017500091054CF4803A910509F49FC0883A9105AF\n:1017600009F0F7C0BAC0803C910509F4E3C0883C99\n:10177000910509F4DFC0883B910509F0EAC0C2C0B9\n:10178000809107038093BB00CFC090912E0380917E\n:101790002F03981768F490912E03E92FF0E0E25F91\n:1017A000FC4F80818093BB009F5F90932E03BCC051\n:1017B00080910803882309F44BC085ED8093BC0019\n:1017C0008091BC0084FDFCCFC2C080E28093730393\n:1017D00085ED8093BC008091BC0084FDFCCFB7C038\n:1017E00080E38093730385ED8093BC008091BC00FF\n:1017F00084FDFCCFACC088E3809373039BC08091D1\n:101800002E039091BB00E82FF0E0E25FFC4F908345\n:101810008F5F80932E0390912E0380912F0382C0BF\n:1018200080912E039091BB00E82FF0E0E25FFC4F27\n:1018300090838F5F80932E0380910803882341F06B\n:1018400085ED8093BC008091BC0084FDFCCF7FC0FF\n:1018500081E08093090384EA6EC085ED8093BC002B\n:101860008091BC0084FDFCCF72C083E080930603AE\n:101870001092720359C080917203803208F056C0F2\n:10188000809172039091BB00E82FF0E0EE5AFC4F7C\n:1018900090838F5F8093720347C080917203803280\n:1018A00030F4E0917203F0E0EE5AFC4F108285EDC7\n:1018B0008093BC008091BC0084FDFCCF1092060395\n:1018C00060917203E0910C03F0910D0382E593E0C7\n:1018D00070E00995109272032DC084E08093060396\n:1018E0001092500310925103E0910A03F0910B0300\n:1018F000099580915103882329F481E08093510355\n:101900001092300390915003E92FF0E0E05DFC4F1E\n:1019100080818093BB009F5F909350039091500310\n:1019200080915103981710F485EC01C085E88093ED\n:10193000BC000FC085EC8093BC0009C010927303FB\n:1019400085ED8093BC008091BC0084FDFCCF10929B\n:101950000603FF91EF91BF91AF919F918F917F917E\n:101960006F915F914F913F912F910F900FBE0F900C\n:101970001F9018951092060381E08093080310923F\n:10198000090382E161E00E94681383E161E00E9443\n:101990006813E9EBF0E080818E7F808380818D7F0A\n:1019A000808388E48093B80085E48093BC00089528\n:1019B000EF92FF920F931F937C018B01DC01ED915D\n:1019C000FC91A081B1816F772D913C91CF01F901FC\n:1019D0000995D701ED91FC91A081B181000F012FF4\n:1019E000001F110B0F772D913C91CF01602FF90152\n:1019F00009951F910F91FF90EF900895FC010190C0\n:101A0000F081E02DA081B1812D913C91CF0160EF5B\n:101A1000F90109950895FC010190F081E02DA08164\n:101A2000B1812D913C91CF0167EFF901099508959E\n:101A30000F931F938C01DC01ED91FC91A081B1818A\n:101A40002D913C91CF0169EFF9010995D801ED91F4\n:101A5000FC91A081B1812D913C91CF0162E0F9010F\n:101A60000995D801ED91FC91A081B1812D913C9116\n:101A7000CF0163E0F90109951F910F9108951F931C\n:101A8000CF93DF93EC018A818823C9F1CE010E94B4\n:101A9000FE0CE881F981A081B1812D913C91CF01AB\n:101AA00069E7F9010995E881F981A081B1812B816C\n:101AB0003C814D915C91CF01F9016081FA0109955A\n:101AC000E881F981A081B1812B813C814D915C91AC\n:101AD000CF01F9016181FA01099512E00AC0EB8199\n:101AE000FC81E10FF11D6081CE0170E00E94D80CF5\n:101AF0001F5F8A81181798F3CE010E940B0DDF91AA\n:101B0000CF911F910895FC01A081B181ED91FC91CD\n:101B100011970480F581E02DCD0109950895EF928C\n:101B2000FF920F931F938C017A01DC01ED91FC91E0\n:101B3000A081B1816F70606E2D913C91CF01F90150\n:101B40000995C801B7010E94D80C1F910F91FF9011\n:101B5000EF900895EF92FF920F931F937C018A01FB\n:101B6000DC01ED91FC91A081B1816F7060692D91D4\n:101B70003C91CF01F9010995D701ED91FC91A0812C\n:101B8000B181602F6F772D913C91CF01F9010995BB\n:101B9000D701ED91FC91A081B181000F012F001FB1\n:101BA000110B2D913C91CF01602FF90109951F91E7\n:101BB0000F91FF90EF900895DF92EF92FF920F93B5\n:101BC0001F93CF93DF93EC01162FD42E022FF32E09\n:101BD0000E94FE0CE881F981A081B1812D913C9198\n:101BE000CF01612FF9010995202F3F2DC9017C01FB\n:101BF00010E008C0F70161917F01CE0170E00E9402\n:101C0000D80C1F5F1D15B0F3CE010E940B0DDF91A4\n:101C1000CF911F910F91FF90EF90DF900895FC01FD\n:101C2000603DA9F0613D28F4603959F0603CA1F4B1\n:101C30000BC0603E19F0643F79F40CC054A743A771\n:101C4000089556A745A7089550AB47A7089552ABEE\n:101C500041AB089554AB43AB0895FC016F3F11F4C1\n:101C600056AB45AB0895FC0152AF41AF0895FC015E\n:101C7000158216821782DC0180E018961C92189754\n:101C80008F5F11968032C9F710A612A611A605A87B\n:101C9000F6A9E02D309709F009950895FC017183AC\n:101CA000608312820E94370E089584E793E060E417\n:101CB00074E00E944E0E08954F925F926F927F9251\n:101CC0008F929F92AF92BF92CF92DF92EF92FF924C\n:101CD0000F93DF93CF9300D0CDB7DEB72B017A01FE\n:101CE0003A8329838DE061E00E94291300E0898115\n:101CF0009A813C01882477FC8094982C5701CC244D\n:101D0000B7FCC094DC2C11C0C401B3010E940912BD\n:101D10008DE061E00E946813C601B5010E940912BE\n:101D20008DE060E00E9468130F5F802F90E08415C3\n:101D3000950554F30F900F90CF91DF910F91FF9085\n:101D4000EF90DF90CF90BF90AF909F908F907F905B\n:101D50006F905F904F9008950F931F938C018DE0CB\n:101D600061E00E942913C80162E070E048E250E09F\n:101D700022ED30E00E945C0E6AEF70E080E090E0BF\n:101D80000E940912C80163E070E048E250E022EDD1\n:101D900030E00E945C0E6DE770E080E090E00E9411\n:101DA00009121F910F9108959A01FA0101900020E4\n:101DB000E9F73197E41BF50B4E2F0E94DC0D0895D7\n:101DC000AB0161E70E94D40E08951F93CF93DF9378\n:101DD000EC018885813731F0893789F5CE010E9481\n:101DE0003F0D36C08FA998AD892B91F189A59AA591\n:101DF000019762E070E00E948416162F862F90E013\n:101E00000E947E10AC01DC0121E030E011C0FE0137\n:101E1000E20FF11D90859C932F5FFE01E20FF11DF3\n:101E20008085879588278795890F8D932F5F3F5FE2\n:101E3000311768F3EFA9F8ADCA01099509C0E9ADFA\n:101E4000FAAD309729F069A561502996AE01099540\n:101E5000DF91CF911F910895CF93DF93EC01A8817B\n:101E6000B981ED91FC9111970680F781E02DCD01AC\n:101E70000995AC0188A5882391F0473F510529F4C5\n:101E800018A6CE010E94E50E93C089A59AA5FE0171\n:101E9000E80FF91F408701969AA789A789C08D810D\n:101EA000882309F446C0403851050CF042C08150E7\n:101EB0008D83FE01E80FF11D4087882309F078C06B\n:101EC0008E81882309F474C0803D49F1813D28F456\n:101ED000803959F0803C59F51FC0803E19F0843F8D\n:101EE00031F513C0EBA5FCA502C0EDA5FEA530970A\n:101EF000F1F0688570E07695762F6627779567957F\n:101F00008985680F711D8F8111C0EBA9FCA93097DD\n:101F100071F06885898509C0EFA5F8A902C0E9A913\n:101F2000FAA9309721F068858F8170E009951E82AB\n:101F30003FC0403F510514F09A0106C09A01207F2E\n:101F40003070842F8F708F83203E3105F1F0213E59\n:101F5000310554F4203C3105D1F0203D3105B9F074\n:101F60002039310529F511C0243F310571F0253F95\n:101F7000310524F4203F3105D9F40DC0293F310546\n:101F800099F02F3F3105A1F40BC082E001C081E040\n:101F90008D832E830DC081E088A71AA619A608C0DC\n:101FA000CE010E94370E04C084E793E00E94180D12\n:101FB000DF91CF910895AF92BF92CF92DF92EF92CF\n:101FC000FF920F931F93CF93DF938C01D62EC72ED2\n:101FD000B42EA22E862F972F61EB71E00E94A900EC\n:101FE000EC018D2D9C2D6FE270E00E949E002097E9\n:101FF00079F07C010894E11CF11CE114F10441F03A\n:102000009E012E5F822F8E19D80112968C930FC0DD\n:10201000AD2DBC2DFD0101900020E9F7ED19EF5F1A\n:10202000D8011296EC932D2D3C2DC9017C01F801AD\n:10203000828190E00E947E10FC01D80114969C934E\n:102040008E93139712968C911297E80FF11D1082C0\n:102050001396ED91FC911497B0821396ED91FC913B\n:102060001497A18213968D919C91149712964C917E\n:1020700050E0425050400296B7010E948F00DF911D\n:10208000CF911F910F91FF90EF90DF90CF90BF9075\n:10209000AF9008950F931F938C0180E494E00E9409\n:1020A0004A14D801ED91FC9180914204909143042F\n:1020B000938382838091440490914504A0914604C7\n:1020C000B091470484839583A683B78380914804A5\n:1020D00090914904A0914A04B0914B048087918764\n:1020E000A287B387C8010E94AC0EC8010E94180DD8\n:1020F000C8010E943F0D1F910F9108950F931F93E8\n:10210000CF93DF93BC018230910510F462E070E060\n:10211000E0916404F0916504A0E0B0E040E050E09C\n:1021200024C08081918186179707D0F08617970782\n:1021300071F482819381109729F013969C938E936A\n:1021400012972CC0909365048093640427C04115B6\n:10215000510519F08417950718F4EF018D01AC01B2\n:10216000DF01828193819C01F9013097D1F64115FD\n:102170005105F9F0CA01861B970B8430910580F454\n:102180008A819B810115110521F0F80193838283D7\n:1021900004C09093650480936404FE01329645C0A8\n:1021A000FE01E80FF91F6193719302979983888369\n:1021B0003CC08091620490916304892B41F480912A\n:1021C000BB019091BC0190936304809362044091A1\n:1021D000BD015091BE014115510541F44DB75EB7A7\n:1021E0008091B9019091BA01481B590B209162046A\n:1021F0003091630424173507B0F4CA01821B930B96\n:102200008617970780F0AB014E5F5F4F84179507E5\n:1022100050F0420F531F5093630440936204F9013E\n:102220006193719302C0E0E0F0E0CF01DF91CF91C4\n:102230001F910F910895CF93DF939C01009709F4AC\n:102240008FC0EC0122971B821A8260916404709106\n:1022500065046115710581F488819981820F931F4E\n:1022600020916204309163042817390739F5D0931F\n:102270006304C093620474C0DB0140E050E0AC171B\n:10228000BD0708F1BB83AA83FE0121913191E20FC2\n:10229000F31FAE17BF0779F48D919C911197280F0A\n:1022A000391F2E5F3F4F3983288312968D919C9161\n:1022B00013979B838A834115510571F4D09365046C\n:1022C000C09364044DC012968D919C911397AD01FB\n:1022D000009711F0DC01D3CFDA011396DC93CE9393\n:1022E0001297FA0121913191E20FF31FCE17DF0708\n:1022F00069F488819981280F391F2E5F3F4FFA01B9\n:10230000318320838A819B8193838283E0E0F0E0A4\n:10231000DB0112968D919C911397009719F0BC01E7\n:10232000FD01F6CFAB014E5F5F4FDB018D919C91BC\n:10233000840F951F20916204309163042817390798\n:1023400079F4309729F4109265041092640402C065\n:1023500013821282425050405093630440936204AF\n:10236000DF91CF9108951F920F920FB60F92112413\n:102370002F933F938F939F93AF93BF938091B3031A\n:102380009091B403A091B503B091B6033091B70317\n:102390000196A11DB11D232F2D5F2D3720F02D5744\n:1023A0000196A11DB11D2093B7038093B3039093B1\n:1023B000B403A093B503B093B6038091AF0390919B\n:1023C000B003A091B103B091B2030196A11DB11D5C\n:1023D0008093AF039093B003A093B103B093B20383\n:1023E000BF91AF919F918F913F912F910F900FBE11\n:1023F0000F901F9018958FB7F8942091B3033091E8\n:10240000B4034091B5035091B6038FBFB901CA011F\n:1024100008959B01AC017FB7F8948091AF03909130\n:10242000B003A091B103B091B20366B5A89B05C0FB\n:102430006F3F19F00196A11DB11D7FBFBA2FA92FC3\n:10244000982F8827860F911DA11DB11D62E0880F6E\n:10245000991FAA1FBB1F6A95D1F7BC012DC0FFB7FA\n:10246000F8948091AF039091B003A091B103B09123\n:10247000B203E6B5A89B05C0EF3F19F00196A11D78\n:10248000B11DFFBFBA2FA92F982F88278E0F911D3E\n:10249000A11DB11DE2E0880F991FAA1FBB1FEA957D\n:1024A000D1F7861B970B885E9340C8F221503040CD\n:1024B0004040504068517C4F211531054105510580\n:1024C00071F60895019739F0880F991F880F991FA9\n:1024D00002970197F1F70895789484B5826084BDDE\n:1024E00084B5816084BD85B5826085BD85B5816018\n:1024F00085BDEEE6F0E0808181608083E1E8F0E078\n:102500001082808182608083808181608083E0E8A6\n:10251000F0E0808181608083E1EBF0E08081846085\n:102520008083E0EBF0E0808181608083EAE7F0E087\n:1025300080818460808380818260808380818160EB\n:1025400080838081806880831092C1000895982FD5\n:102550008E3008F09E5097708091BF018295880F51\n:10256000880F807C892B80937C0080917A00806426\n:1025700080937A0080917A0086FDFCCF20917800CC\n:1025800040917900942F80E030E0282B392BC9014D\n:1025900008951F93CF93DF93182FEB0161E00E9402\n:1025A0002913209709F44AC0CF3FD10509F449C047\n:1025B000E12FF0E0E255FF4F84918330C1F0843089\n:1025C00028F4813051F08230B1F50CC0863019F119\n:1025D000873049F1843079F514C084B5806884BDB2\n:1025E000C7BD33C084B5806284BDC8BD2EC0809194\n:1025F0008000806880938000D0938900C093880019\n:1026000024C080918000806280938000D0938B00F2\n:10261000C0938A001AC08091B00080688093B00097\n:10262000C093B30012C08091B00080628093B0006C\n:10263000C093B4000AC0C038D1051CF4812F60E0FB\n:1026400002C0812F61E00E946813DF91CF911F913A\n:102650000895CF93DF93482F50E0CA0186569F4FCD\n:10266000FC0134914A575F4FFA018491882369F144\n:1026700090E0880F991FFC01E859FF4FA591B49194\n:10268000FC01EE58FF4FC591D491662351F42FB74A\n:10269000F8948C91932F909589238C93888189232A\n:1026A0000BC0623061F42FB7F8948C91932F909502\n:1026B00089238C938881832B88832FBF06C09FB783\n:1026C000F8948C91832B8C939FBFDF91CF910895C9\n:1026D000482F50E0CA0182559F4FFC012491CA0146\n:1026E00086569F4FFC0194914A575F4FFA013491EF\n:1026F000332309F440C0222351F1233071F02430F8\n:1027000028F42130A1F0223011F514C02630B1F0A8\n:102710002730C1F02430D9F404C0809180008F7735\n:1027200003C0809180008F7D8093800010C084B5AD\n:102730008F7702C084B58F7D84BD09C08091B000C1\n:102740008F7703C08091B0008F7D8093B000E32F1E\n:10275000F0E0EE0FFF1FEE58FF4FA591B4912FB799\n:10276000F894662321F48C919095892302C08C9172\n:10277000892B8C932FBF089508951F920F920FB647\n:102780000F9211242F933F934F938F939F93EF9327\n:10279000FF938091C00082FD1DC04091C600209132\n:1027A000F8033091F9032F5F3F4F2F733070809102\n:1027B000FA039091FB032817390771F0E091F803B1\n:1027C000F091F903E854FC4F40833093F9032093D0\n:1027D000F80302C08091C600FF91EF919F918F9105\n:1027E0004F913F912F910F900FBE0F901F90189512\n:1027F000E0914C04F0914D04E05CFF4F8191919188\n:1028000020813181805C9F4F821B930B60E470E0DC\n:102810000E948416892B11F00E94BC1308951F9208\n:102820000F920FB60F9211242F933F938F939F9384\n:10283000EF93FF9320913C0430913D0480913E043E\n:1028400090913F042817390731F48091C1008F7DA2\n:102850008093C10014C0E0913E04F0913F04E45025\n:10286000FC4F208180913E0490913F0401968F732C\n:10287000907090933F0480933E042093C600FF9194\n:10288000EF919F918F913F912F910F900FBE0F90DD\n:102890001F901895AF92BF92DF92EF92FF920F9325\n:1028A0001F93CF93DF93EC017A018B01DD2440303D\n:1028B00081EE580780E0680780E0780711F0DD249A\n:1028C000D39491E0A92EB12CEC89FD89DD2069F02B\n:1028D000C50108A002C0880F991F0A94E2F78083FF\n:1028E00060E079E08DE390E005C0108260E874E874\n:1028F0008EE190E0A80197010E9497162150304088\n:1029000040405040569547953795279580E12030B7\n:10291000380720F0DD2011F0DD24D6CFE889F989D1\n:102920003083EA89FB89208319A2EE89FF894081DF\n:1029300021E030E0C9010C8C02C0880F991F0A9475\n:10294000E2F7482B4083EE89FF894081C9010D8C55\n:1029500002C0880F991F0A94E2F7482B4083EE8942\n:10296000FF894081C9010E8C02C0880F991F0A940B\n:10297000E2F7482B4083EE89FF8980810F8C02C0EB\n:10298000220F331F0A94E2F7209528232083DF913A\n:10299000CF911F910F91FF90EF90DF90BF90AF907C\n:1029A0000895DC011C96ED91FC911D97E05CFF4FB2\n:1029B0008191919120813181805C9F4F821B930B8B\n:1029C00060E470E00E9484160895DC011C96ED918D\n:1029D000FC911D97E05CFF4F20813181E054F04075\n:1029E000DF01AE5BBF4F8D919C911197281739077E\n:1029F00019F42FEF3FEF07C08D919C91E80FF91F5D\n:102A00008081282F30E0C9010895DC011C96ED91EA\n:102A1000FC911D97E05CFF4F20813181E054F04034\n:102A2000DF01AE5BBF4F8D919C911197281739073D\n:102A300019F42FEF3FEF10C08D919C911197E80F83\n:102A4000F91F20818D919C91119701968F73907041\n:102A500011969C938E9330E0C9010895DC01919604\n:102A60008C919197882339F05496ED91FC9155976C\n:102A7000808186FFF9CF91961C920895CF93DF93C2\n:102A8000EC01EE85FF85E05CFF4F20813181E05451\n:102A9000F0402F5F3F4F2F733070DF01AE5BBF4FB1\n:102AA0008D919C91119728173907D1F3E05CFF4F66\n:102AB00080819181E054F040E80FF91F6083EE853A\n:102AC000FF85E05CFF4F31832083EE89FF89208101\n:102AD00081E090E00F8C02C0880F991F0A94E2F702\n:102AE000282B208381E089A3EC89FD898081806483\n:102AF000808381E090E0DF91CF91089510924304AC\n:102B00001092420488EE93E0A0E0B0E08093440489\n:102B100090934504A0934604B093470484ED91E05C\n:102B2000909341048093400488EB93E090934D048C\n:102B300080934C048CEF93E090934F0480934E0469\n:102B400085EC90E0909351048093500484EC90E0E5\n:102B5000909353048093520480EC90E0909355043A\n:102B60008093540481EC90E0909357048093560432\n:102B700082EC90E0909359048093580486EC90E0A6\n:102B800090935B0480935A0484E080935C0483E018\n:102B900080935D0487E080935E0485E080935F040A\n:102BA00081E08093600408950895CF93DF930E949D\n:102BB0006C120E94D4150E943403C8EFD3E10E9426\n:102BC0004A042097E1F30E94F813F9CFCF92DF92E5\n:102BD000EF92FF920F931F93CF93DF937C016B01D2\n:102BE0008A01C0E0D0E00FC0D6016D916D01D70120\n:102BF000ED91FC910190F081E02DC7010995C80F7E\n:102C0000D91F015010400115110571F7CE01DF9158\n:102C1000CF911F910F91FF90EF90DF90CF9008958B\n:102C20002F923F924F925F926F927F928F929F92DC\n:102C3000AF92BF92CF92DF92EF92FF920F931F93CA\n:102C4000DF93CF93CDB7DEB73B014C0119012A01C9\n:102C50006D897E898F89988D6A197B098C099D09F8\n:102C6000621A730A840A950AA40193010E945916F4\n:102C7000E218F30804091509A80197010E94B91682\n:102C80002A0D3B1D4C1D5D1DB901CA01CF91DF917D\n:102C90001F910F91FF90EF90DF90CF90BF90AF907A\n:102CA0009F908F907F906F905F904F903F902F906C\n:102CB0000895629FD001739FF001829FE00DF11D86\n:102CC000649FE00DF11D929FF00D839FF00D749FA6\n:102CD000F00D659FF00D9927729FB00DE11DF91F52\n:102CE000639FB00DE11DF91FBD01CF0111240895AF\n:102CF000991B79E004C0991F961708F0961B881F4E\n:102D00007A95C9F78095089597FB092E07260AD072\n:102D100077FD04D049D006D000201AF47095619553\n:102D20007F4F0895F6F7909581959F4F0895A1E202\n:102D30001A2EAA1BBB1BFD010DC0AA1FBB1FEE1F35\n:102D4000FF1FA217B307E407F50720F0A21BB30B80\n:102D5000E40BF50B661F771F881F991F1A9469F7FC\n:102D600060957095809590959B01AC01BD01CF0158\n:102D7000089597FB092E05260ED057FD04D0D7DF06\n:102D80000AD0001C38F450954095309521953F4F5E\n:102D90004F4F5F4F0895F6F7909580957095619528\n:102DA0007F4F8F4F9F4F0895AA1BBB1B51E107C058\n:102DB000AA1FBB1FA617B70710F0A61BB70B881FCB\n:102DC000991F5A95A9F780959095BC01CD0108955A\n:102DD000EE0FFF1F0590F491E02D0994F894FFCFBA\n:102DE000556E6B6E6F776E2070696E206D6F6465C7\n:102DF000005374616E646172644669726D617461DE\n:102E00002E696E6F0049324320526561642045721D\n:102E1000726F723A20546F6F206D616E7920627903\n:102E20007465732072656365697665640049324331\n:102E30002052656164204572726F723A20546F6F40\n:102E400020666577206279746573207265636569B1\n:102E50007665640031302D62697420616464726546\n:102E60007373696E67206D6F6465206973206E6F80\n:102E7000742079657420737570706F727465640066\n:102E8000746F6F206D616E792071756572696573FD\n:102E9000002E637070001300FF80006604000001C4\n:102EA000000000000D0ADC0995099E09B309C40958\n:102EB000000000003E15E615D1140515E5142E1589\n:00000001FF";

var hex = intel_hex.parse(data).data;

//TODO standardize chip configs
//uno
var pageSize = 128;
var baud = 115200;
var delay1 = 1; //minimum is 2.5us, so anything over 1 fine?
var delay2 = 1;

var options = {
  devicecode:0,
  revision:0,
  progtype:0,
  parmode:0,
  polling:0,
  selftimed:0,
  lockbytes:0,
  fusebytes:0,
  flashpollval1:0,
  flashpollval2:0,
  eeprompollval1:0,
  eeprompollval2:0,
  pagesizehigh:0,
  pagesizelow:pageSize,
  eepromsizehigh:0,
  eepromsizelow:0,
  flashsize4:0,
  flashsize3:0,
  flashsize2:0,
  flashsize1:0
};


(function() {

function upload(done){


SerialPort.list(function (err, ports) {
  ports.forEach(function(port) {

    console.log("found " + port.comName);

    if(usbttyRE.test(port.comName))
    {

      console.log("trying" + port.comName);

      var serialPort = new SerialPort.SerialPort(port.comName, {
        baudrate: 115200,
        // parser: SerialPort.parsers.raw
      }, false);

      var programmer = new stk500(serialPort);

      async.series([
        programmer.connect.bind(programmer),
        programmer.reset.bind(programmer,delay1, delay2),
        programmer.sync.bind(programmer, 5),
        programmer.setOptions.bind(programmer, options),
        programmer.enterProgrammingMode.bind(programmer),
        programmer.upload.bind(programmer, hex, pageSize),
        programmer.exitProgrammingMode.bind(programmer),
        programmer.disconnect.bind(programmer)

      ], function(error){
        if(error){
          console.log("programing FAILED: " + error);
        }else{
          console.log("programing SUCCESS!");
        }
      });

    }else{
      console.log("skipping " + port.comName);
    }

  });
});

}


window.stk500 = {
  upload:upload
};


})(window);

},{"async":1,"browser-serialport":2,"intel-hex":3,"stk500":4}],7:[function(require,module,exports){
/*!
 * The buffer module from node.js, for the browser.
 *
 * @author   Feross Aboukhadijeh <feross@feross.org> <http://feross.org>
 * @license  MIT
 */

var base64 = require('base64-js')
var ieee754 = require('ieee754')
var isArray = require('is-array')

exports.Buffer = Buffer
exports.SlowBuffer = Buffer
exports.INSPECT_MAX_BYTES = 50
Buffer.poolSize = 8192 // not used by this implementation

var kMaxLength = 0x3fffffff

/**
 * If `Buffer.TYPED_ARRAY_SUPPORT`:
 *   === true    Use Uint8Array implementation (fastest)
 *   === false   Use Object implementation (most compatible, even IE6)
 *
 * Browsers that support typed arrays are IE 10+, Firefox 4+, Chrome 7+, Safari 5.1+,
 * Opera 11.6+, iOS 4.2+.
 *
 * Note:
 *
 * - Implementation must support adding new properties to `Uint8Array` instances.
 *   Firefox 4-29 lacked support, fixed in Firefox 30+.
 *   See: https://bugzilla.mozilla.org/show_bug.cgi?id=695438.
 *
 *  - Chrome 9-10 is missing the `TypedArray.prototype.subarray` function.
 *
 *  - IE10 has a broken `TypedArray.prototype.subarray` function which returns arrays of
 *    incorrect length in some situations.
 *
 * We detect these buggy browsers and set `Buffer.TYPED_ARRAY_SUPPORT` to `false` so they will
 * get the Object implementation, which is slower but will work correctly.
 */
Buffer.TYPED_ARRAY_SUPPORT = (function () {
  try {
    var buf = new ArrayBuffer(0)
    var arr = new Uint8Array(buf)
    arr.foo = function () { return 42 }
    return 42 === arr.foo() && // typed array instances can be augmented
        typeof arr.subarray === 'function' && // chrome 9-10 lack `subarray`
        new Uint8Array(1).subarray(1, 1).byteLength === 0 // ie10 has broken `subarray`
  } catch (e) {
    return false
  }
})()

/**
 * Class: Buffer
 * =============
 *
 * The Buffer constructor returns instances of `Uint8Array` that are augmented
 * with function properties for all the node `Buffer` API functions. We use
 * `Uint8Array` so that square bracket notation works as expected -- it returns
 * a single octet.
 *
 * By augmenting the instances, we can avoid modifying the `Uint8Array`
 * prototype.
 */
function Buffer (subject, encoding, noZero) {
  if (!(this instanceof Buffer))
    return new Buffer(subject, encoding, noZero)

  var type = typeof subject

  // Find the length
  var length
  if (type === 'number')
    length = subject > 0 ? subject >>> 0 : 0
  else if (type === 'string') {
    if (encoding === 'base64')
      subject = base64clean(subject)
    length = Buffer.byteLength(subject, encoding)
  } else if (type === 'object' && subject !== null) { // assume object is array-like
    if (subject.type === 'Buffer' && isArray(subject.data))
      subject = subject.data
    length = +subject.length > 0 ? Math.floor(+subject.length) : 0
  } else
    throw new TypeError('must start with number, buffer, array or string')

  if (this.length > kMaxLength)
    throw new RangeError('Attempt to allocate Buffer larger than maximum ' +
      'size: 0x' + kMaxLength.toString(16) + ' bytes')

  var buf
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    // Preferred: Return an augmented `Uint8Array` instance for best performance
    buf = Buffer._augment(new Uint8Array(length))
  } else {
    // Fallback: Return THIS instance of Buffer (created by `new`)
    buf = this
    buf.length = length
    buf._isBuffer = true
  }

  var i
  if (Buffer.TYPED_ARRAY_SUPPORT && typeof subject.byteLength === 'number') {
    // Speed optimization -- use set if we're copying from a typed array
    buf._set(subject)
  } else if (isArrayish(subject)) {
    // Treat array-ish objects as a byte array
    if (Buffer.isBuffer(subject)) {
      for (i = 0; i < length; i++)
        buf[i] = subject.readUInt8(i)
    } else {
      for (i = 0; i < length; i++)
        buf[i] = ((subject[i] % 256) + 256) % 256
    }
  } else if (type === 'string') {
    buf.write(subject, 0, encoding)
  } else if (type === 'number' && !Buffer.TYPED_ARRAY_SUPPORT && !noZero) {
    for (i = 0; i < length; i++) {
      buf[i] = 0
    }
  }

  return buf
}

Buffer.isBuffer = function (b) {
  return !!(b != null && b._isBuffer)
}

Buffer.compare = function (a, b) {
  if (!Buffer.isBuffer(a) || !Buffer.isBuffer(b))
    throw new TypeError('Arguments must be Buffers')

  var x = a.length
  var y = b.length
  for (var i = 0, len = Math.min(x, y); i < len && a[i] === b[i]; i++) {}
  if (i !== len) {
    x = a[i]
    y = b[i]
  }
  if (x < y) return -1
  if (y < x) return 1
  return 0
}

Buffer.isEncoding = function (encoding) {
  switch (String(encoding).toLowerCase()) {
    case 'hex':
    case 'utf8':
    case 'utf-8':
    case 'ascii':
    case 'binary':
    case 'base64':
    case 'raw':
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      return true
    default:
      return false
  }
}

Buffer.concat = function (list, totalLength) {
  if (!isArray(list)) throw new TypeError('Usage: Buffer.concat(list[, length])')

  if (list.length === 0) {
    return new Buffer(0)
  } else if (list.length === 1) {
    return list[0]
  }

  var i
  if (totalLength === undefined) {
    totalLength = 0
    for (i = 0; i < list.length; i++) {
      totalLength += list[i].length
    }
  }

  var buf = new Buffer(totalLength)
  var pos = 0
  for (i = 0; i < list.length; i++) {
    var item = list[i]
    item.copy(buf, pos)
    pos += item.length
  }
  return buf
}

Buffer.byteLength = function (str, encoding) {
  var ret
  str = str + ''
  switch (encoding || 'utf8') {
    case 'ascii':
    case 'binary':
    case 'raw':
      ret = str.length
      break
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      ret = str.length * 2
      break
    case 'hex':
      ret = str.length >>> 1
      break
    case 'utf8':
    case 'utf-8':
      ret = utf8ToBytes(str).length
      break
    case 'base64':
      ret = base64ToBytes(str).length
      break
    default:
      ret = str.length
  }
  return ret
}

// pre-set for values that may exist in the future
Buffer.prototype.length = undefined
Buffer.prototype.parent = undefined

// toString(encoding, start=0, end=buffer.length)
Buffer.prototype.toString = function (encoding, start, end) {
  var loweredCase = false

  start = start >>> 0
  end = end === undefined || end === Infinity ? this.length : end >>> 0

  if (!encoding) encoding = 'utf8'
  if (start < 0) start = 0
  if (end > this.length) end = this.length
  if (end <= start) return ''

  while (true) {
    switch (encoding) {
      case 'hex':
        return hexSlice(this, start, end)

      case 'utf8':
      case 'utf-8':
        return utf8Slice(this, start, end)

      case 'ascii':
        return asciiSlice(this, start, end)

      case 'binary':
        return binarySlice(this, start, end)

      case 'base64':
        return base64Slice(this, start, end)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return utf16leSlice(this, start, end)

      default:
        if (loweredCase)
          throw new TypeError('Unknown encoding: ' + encoding)
        encoding = (encoding + '').toLowerCase()
        loweredCase = true
    }
  }
}

Buffer.prototype.equals = function (b) {
  if(!Buffer.isBuffer(b)) throw new TypeError('Argument must be a Buffer')
  return Buffer.compare(this, b) === 0
}

Buffer.prototype.inspect = function () {
  var str = ''
  var max = exports.INSPECT_MAX_BYTES
  if (this.length > 0) {
    str = this.toString('hex', 0, max).match(/.{2}/g).join(' ')
    if (this.length > max)
      str += ' ... '
  }
  return '<Buffer ' + str + '>'
}

Buffer.prototype.compare = function (b) {
  if (!Buffer.isBuffer(b)) throw new TypeError('Argument must be a Buffer')
  return Buffer.compare(this, b)
}

// `get` will be removed in Node 0.13+
Buffer.prototype.get = function (offset) {
  console.log('.get() is deprecated. Access using array indexes instead.')
  return this.readUInt8(offset)
}

// `set` will be removed in Node 0.13+
Buffer.prototype.set = function (v, offset) {
  console.log('.set() is deprecated. Access using array indexes instead.')
  return this.writeUInt8(v, offset)
}

function hexWrite (buf, string, offset, length) {
  offset = Number(offset) || 0
  var remaining = buf.length - offset
  if (!length) {
    length = remaining
  } else {
    length = Number(length)
    if (length > remaining) {
      length = remaining
    }
  }

  // must be an even number of digits
  var strLen = string.length
  if (strLen % 2 !== 0) throw new Error('Invalid hex string')

  if (length > strLen / 2) {
    length = strLen / 2
  }
  for (var i = 0; i < length; i++) {
    var byte = parseInt(string.substr(i * 2, 2), 16)
    if (isNaN(byte)) throw new Error('Invalid hex string')
    buf[offset + i] = byte
  }
  return i
}

function utf8Write (buf, string, offset, length) {
  var charsWritten = blitBuffer(utf8ToBytes(string), buf, offset, length)
  return charsWritten
}

function asciiWrite (buf, string, offset, length) {
  var charsWritten = blitBuffer(asciiToBytes(string), buf, offset, length)
  return charsWritten
}

function binaryWrite (buf, string, offset, length) {
  return asciiWrite(buf, string, offset, length)
}

function base64Write (buf, string, offset, length) {
  var charsWritten = blitBuffer(base64ToBytes(string), buf, offset, length)
  return charsWritten
}

function utf16leWrite (buf, string, offset, length) {
  var charsWritten = blitBuffer(utf16leToBytes(string), buf, offset, length)
  return charsWritten
}

Buffer.prototype.write = function (string, offset, length, encoding) {
  // Support both (string, offset, length, encoding)
  // and the legacy (string, encoding, offset, length)
  if (isFinite(offset)) {
    if (!isFinite(length)) {
      encoding = length
      length = undefined
    }
  } else {  // legacy
    var swap = encoding
    encoding = offset
    offset = length
    length = swap
  }

  offset = Number(offset) || 0
  var remaining = this.length - offset
  if (!length) {
    length = remaining
  } else {
    length = Number(length)
    if (length > remaining) {
      length = remaining
    }
  }
  encoding = String(encoding || 'utf8').toLowerCase()

  var ret
  switch (encoding) {
    case 'hex':
      ret = hexWrite(this, string, offset, length)
      break
    case 'utf8':
    case 'utf-8':
      ret = utf8Write(this, string, offset, length)
      break
    case 'ascii':
      ret = asciiWrite(this, string, offset, length)
      break
    case 'binary':
      ret = binaryWrite(this, string, offset, length)
      break
    case 'base64':
      ret = base64Write(this, string, offset, length)
      break
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      ret = utf16leWrite(this, string, offset, length)
      break
    default:
      throw new TypeError('Unknown encoding: ' + encoding)
  }
  return ret
}

Buffer.prototype.toJSON = function () {
  return {
    type: 'Buffer',
    data: Array.prototype.slice.call(this._arr || this, 0)
  }
}

function base64Slice (buf, start, end) {
  if (start === 0 && end === buf.length) {
    return base64.fromByteArray(buf)
  } else {
    return base64.fromByteArray(buf.slice(start, end))
  }
}

function utf8Slice (buf, start, end) {
  var res = ''
  var tmp = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; i++) {
    if (buf[i] <= 0x7F) {
      res += decodeUtf8Char(tmp) + String.fromCharCode(buf[i])
      tmp = ''
    } else {
      tmp += '%' + buf[i].toString(16)
    }
  }

  return res + decodeUtf8Char(tmp)
}

function asciiSlice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; i++) {
    ret += String.fromCharCode(buf[i])
  }
  return ret
}

function binarySlice (buf, start, end) {
  return asciiSlice(buf, start, end)
}

function hexSlice (buf, start, end) {
  var len = buf.length

  if (!start || start < 0) start = 0
  if (!end || end < 0 || end > len) end = len

  var out = ''
  for (var i = start; i < end; i++) {
    out += toHex(buf[i])
  }
  return out
}

function utf16leSlice (buf, start, end) {
  var bytes = buf.slice(start, end)
  var res = ''
  for (var i = 0; i < bytes.length; i += 2) {
    res += String.fromCharCode(bytes[i] + bytes[i + 1] * 256)
  }
  return res
}

Buffer.prototype.slice = function (start, end) {
  var len = this.length
  start = ~~start
  end = end === undefined ? len : ~~end

  if (start < 0) {
    start += len;
    if (start < 0)
      start = 0
  } else if (start > len) {
    start = len
  }

  if (end < 0) {
    end += len
    if (end < 0)
      end = 0
  } else if (end > len) {
    end = len
  }

  if (end < start)
    end = start

  if (Buffer.TYPED_ARRAY_SUPPORT) {
    return Buffer._augment(this.subarray(start, end))
  } else {
    var sliceLen = end - start
    var newBuf = new Buffer(sliceLen, undefined, true)
    for (var i = 0; i < sliceLen; i++) {
      newBuf[i] = this[i + start]
    }
    return newBuf
  }
}

/*
 * Need to make sure that buffer isn't trying to write out of bounds.
 */
function checkOffset (offset, ext, length) {
  if ((offset % 1) !== 0 || offset < 0)
    throw new RangeError('offset is not uint')
  if (offset + ext > length)
    throw new RangeError('Trying to access beyond buffer length')
}

Buffer.prototype.readUInt8 = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 1, this.length)
  return this[offset]
}

Buffer.prototype.readUInt16LE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 2, this.length)
  return this[offset] | (this[offset + 1] << 8)
}

Buffer.prototype.readUInt16BE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 2, this.length)
  return (this[offset] << 8) | this[offset + 1]
}

Buffer.prototype.readUInt32LE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 4, this.length)

  return ((this[offset]) |
      (this[offset + 1] << 8) |
      (this[offset + 2] << 16)) +
      (this[offset + 3] * 0x1000000)
}

Buffer.prototype.readUInt32BE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 4, this.length)

  return (this[offset] * 0x1000000) +
      ((this[offset + 1] << 16) |
      (this[offset + 2] << 8) |
      this[offset + 3])
}

Buffer.prototype.readInt8 = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 1, this.length)
  if (!(this[offset] & 0x80))
    return (this[offset])
  return ((0xff - this[offset] + 1) * -1)
}

Buffer.prototype.readInt16LE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 2, this.length)
  var val = this[offset] | (this[offset + 1] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt16BE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 2, this.length)
  var val = this[offset + 1] | (this[offset] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt32LE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 4, this.length)

  return (this[offset]) |
      (this[offset + 1] << 8) |
      (this[offset + 2] << 16) |
      (this[offset + 3] << 24)
}

Buffer.prototype.readInt32BE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 4, this.length)

  return (this[offset] << 24) |
      (this[offset + 1] << 16) |
      (this[offset + 2] << 8) |
      (this[offset + 3])
}

Buffer.prototype.readFloatLE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, true, 23, 4)
}

Buffer.prototype.readFloatBE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, false, 23, 4)
}

Buffer.prototype.readDoubleLE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, true, 52, 8)
}

Buffer.prototype.readDoubleBE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, false, 52, 8)
}

function checkInt (buf, value, offset, ext, max, min) {
  if (!Buffer.isBuffer(buf)) throw new TypeError('buffer must be a Buffer instance')
  if (value > max || value < min) throw new TypeError('value is out of bounds')
  if (offset + ext > buf.length) throw new TypeError('index out of range')
}

Buffer.prototype.writeUInt8 = function (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert)
    checkInt(this, value, offset, 1, 0xff, 0)
  if (!Buffer.TYPED_ARRAY_SUPPORT) value = Math.floor(value)
  this[offset] = value
  return offset + 1
}

function objectWriteUInt16 (buf, value, offset, littleEndian) {
  if (value < 0) value = 0xffff + value + 1
  for (var i = 0, j = Math.min(buf.length - offset, 2); i < j; i++) {
    buf[offset + i] = (value & (0xff << (8 * (littleEndian ? i : 1 - i)))) >>>
      (littleEndian ? i : 1 - i) * 8
  }
}

Buffer.prototype.writeUInt16LE = function (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert)
    checkInt(this, value, offset, 2, 0xffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = value
    this[offset + 1] = (value >>> 8)
  } else objectWriteUInt16(this, value, offset, true)
  return offset + 2
}

Buffer.prototype.writeUInt16BE = function (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert)
    checkInt(this, value, offset, 2, 0xffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 8)
    this[offset + 1] = value
  } else objectWriteUInt16(this, value, offset, false)
  return offset + 2
}

function objectWriteUInt32 (buf, value, offset, littleEndian) {
  if (value < 0) value = 0xffffffff + value + 1
  for (var i = 0, j = Math.min(buf.length - offset, 4); i < j; i++) {
    buf[offset + i] = (value >>> (littleEndian ? i : 3 - i) * 8) & 0xff
  }
}

Buffer.prototype.writeUInt32LE = function (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert)
    checkInt(this, value, offset, 4, 0xffffffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset + 3] = (value >>> 24)
    this[offset + 2] = (value >>> 16)
    this[offset + 1] = (value >>> 8)
    this[offset] = value
  } else objectWriteUInt32(this, value, offset, true)
  return offset + 4
}

Buffer.prototype.writeUInt32BE = function (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert)
    checkInt(this, value, offset, 4, 0xffffffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 24)
    this[offset + 1] = (value >>> 16)
    this[offset + 2] = (value >>> 8)
    this[offset + 3] = value
  } else objectWriteUInt32(this, value, offset, false)
  return offset + 4
}

Buffer.prototype.writeInt8 = function (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert)
    checkInt(this, value, offset, 1, 0x7f, -0x80)
  if (!Buffer.TYPED_ARRAY_SUPPORT) value = Math.floor(value)
  if (value < 0) value = 0xff + value + 1
  this[offset] = value
  return offset + 1
}

Buffer.prototype.writeInt16LE = function (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert)
    checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = value
    this[offset + 1] = (value >>> 8)
  } else objectWriteUInt16(this, value, offset, true)
  return offset + 2
}

Buffer.prototype.writeInt16BE = function (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert)
    checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 8)
    this[offset + 1] = value
  } else objectWriteUInt16(this, value, offset, false)
  return offset + 2
}

Buffer.prototype.writeInt32LE = function (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert)
    checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = value
    this[offset + 1] = (value >>> 8)
    this[offset + 2] = (value >>> 16)
    this[offset + 3] = (value >>> 24)
  } else objectWriteUInt32(this, value, offset, true)
  return offset + 4
}

Buffer.prototype.writeInt32BE = function (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert)
    checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  if (value < 0) value = 0xffffffff + value + 1
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 24)
    this[offset + 1] = (value >>> 16)
    this[offset + 2] = (value >>> 8)
    this[offset + 3] = value
  } else objectWriteUInt32(this, value, offset, false)
  return offset + 4
}

function checkIEEE754 (buf, value, offset, ext, max, min) {
  if (value > max || value < min) throw new TypeError('value is out of bounds')
  if (offset + ext > buf.length) throw new TypeError('index out of range')
}

function writeFloat (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert)
    checkIEEE754(buf, value, offset, 4, 3.4028234663852886e+38, -3.4028234663852886e+38)
  ieee754.write(buf, value, offset, littleEndian, 23, 4)
  return offset + 4
}

Buffer.prototype.writeFloatLE = function (value, offset, noAssert) {
  return writeFloat(this, value, offset, true, noAssert)
}

Buffer.prototype.writeFloatBE = function (value, offset, noAssert) {
  return writeFloat(this, value, offset, false, noAssert)
}

function writeDouble (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert)
    checkIEEE754(buf, value, offset, 8, 1.7976931348623157E+308, -1.7976931348623157E+308)
  ieee754.write(buf, value, offset, littleEndian, 52, 8)
  return offset + 8
}

Buffer.prototype.writeDoubleLE = function (value, offset, noAssert) {
  return writeDouble(this, value, offset, true, noAssert)
}

Buffer.prototype.writeDoubleBE = function (value, offset, noAssert) {
  return writeDouble(this, value, offset, false, noAssert)
}

// copy(targetBuffer, targetStart=0, sourceStart=0, sourceEnd=buffer.length)
Buffer.prototype.copy = function (target, target_start, start, end) {
  var source = this

  if (!start) start = 0
  if (!end && end !== 0) end = this.length
  if (!target_start) target_start = 0

  // Copy 0 bytes; we're done
  if (end === start) return
  if (target.length === 0 || source.length === 0) return

  // Fatal error conditions
  if (end < start) throw new TypeError('sourceEnd < sourceStart')
  if (target_start < 0 || target_start >= target.length)
    throw new TypeError('targetStart out of bounds')
  if (start < 0 || start >= source.length) throw new TypeError('sourceStart out of bounds')
  if (end < 0 || end > source.length) throw new TypeError('sourceEnd out of bounds')

  // Are we oob?
  if (end > this.length)
    end = this.length
  if (target.length - target_start < end - start)
    end = target.length - target_start + start

  var len = end - start

  if (len < 1000 || !Buffer.TYPED_ARRAY_SUPPORT) {
    for (var i = 0; i < len; i++) {
      target[i + target_start] = this[i + start]
    }
  } else {
    target._set(this.subarray(start, start + len), target_start)
  }
}

// fill(value, start=0, end=buffer.length)
Buffer.prototype.fill = function (value, start, end) {
  if (!value) value = 0
  if (!start) start = 0
  if (!end) end = this.length

  if (end < start) throw new TypeError('end < start')

  // Fill 0 bytes; we're done
  if (end === start) return
  if (this.length === 0) return

  if (start < 0 || start >= this.length) throw new TypeError('start out of bounds')
  if (end < 0 || end > this.length) throw new TypeError('end out of bounds')

  var i
  if (typeof value === 'number') {
    for (i = start; i < end; i++) {
      this[i] = value
    }
  } else {
    var bytes = utf8ToBytes(value.toString())
    var len = bytes.length
    for (i = start; i < end; i++) {
      this[i] = bytes[i % len]
    }
  }

  return this
}

/**
 * Creates a new `ArrayBuffer` with the *copied* memory of the buffer instance.
 * Added in Node 0.12. Only available in browsers that support ArrayBuffer.
 */
Buffer.prototype.toArrayBuffer = function () {
  if (typeof Uint8Array !== 'undefined') {
    if (Buffer.TYPED_ARRAY_SUPPORT) {
      return (new Buffer(this)).buffer
    } else {
      var buf = new Uint8Array(this.length)
      for (var i = 0, len = buf.length; i < len; i += 1) {
        buf[i] = this[i]
      }
      return buf.buffer
    }
  } else {
    throw new TypeError('Buffer.toArrayBuffer not supported in this browser')
  }
}

// HELPER FUNCTIONS
// ================

var BP = Buffer.prototype

/**
 * Augment a Uint8Array *instance* (not the Uint8Array class!) with Buffer methods
 */
Buffer._augment = function (arr) {
  arr.constructor = Buffer
  arr._isBuffer = true

  // save reference to original Uint8Array get/set methods before overwriting
  arr._get = arr.get
  arr._set = arr.set

  // deprecated, will be removed in node 0.13+
  arr.get = BP.get
  arr.set = BP.set

  arr.write = BP.write
  arr.toString = BP.toString
  arr.toLocaleString = BP.toString
  arr.toJSON = BP.toJSON
  arr.equals = BP.equals
  arr.compare = BP.compare
  arr.copy = BP.copy
  arr.slice = BP.slice
  arr.readUInt8 = BP.readUInt8
  arr.readUInt16LE = BP.readUInt16LE
  arr.readUInt16BE = BP.readUInt16BE
  arr.readUInt32LE = BP.readUInt32LE
  arr.readUInt32BE = BP.readUInt32BE
  arr.readInt8 = BP.readInt8
  arr.readInt16LE = BP.readInt16LE
  arr.readInt16BE = BP.readInt16BE
  arr.readInt32LE = BP.readInt32LE
  arr.readInt32BE = BP.readInt32BE
  arr.readFloatLE = BP.readFloatLE
  arr.readFloatBE = BP.readFloatBE
  arr.readDoubleLE = BP.readDoubleLE
  arr.readDoubleBE = BP.readDoubleBE
  arr.writeUInt8 = BP.writeUInt8
  arr.writeUInt16LE = BP.writeUInt16LE
  arr.writeUInt16BE = BP.writeUInt16BE
  arr.writeUInt32LE = BP.writeUInt32LE
  arr.writeUInt32BE = BP.writeUInt32BE
  arr.writeInt8 = BP.writeInt8
  arr.writeInt16LE = BP.writeInt16LE
  arr.writeInt16BE = BP.writeInt16BE
  arr.writeInt32LE = BP.writeInt32LE
  arr.writeInt32BE = BP.writeInt32BE
  arr.writeFloatLE = BP.writeFloatLE
  arr.writeFloatBE = BP.writeFloatBE
  arr.writeDoubleLE = BP.writeDoubleLE
  arr.writeDoubleBE = BP.writeDoubleBE
  arr.fill = BP.fill
  arr.inspect = BP.inspect
  arr.toArrayBuffer = BP.toArrayBuffer

  return arr
}

var INVALID_BASE64_RE = /[^+\/0-9A-z]/g

function base64clean (str) {
  // Node strips out invalid characters like \n and \t from the string, base64-js does not
  str = stringtrim(str).replace(INVALID_BASE64_RE, '')
  // Node allows for non-padded base64 strings (missing trailing ===), base64-js does not
  while (str.length % 4 !== 0) {
    str = str + '='
  }
  return str
}

function stringtrim (str) {
  if (str.trim) return str.trim()
  return str.replace(/^\s+|\s+$/g, '')
}

function isArrayish (subject) {
  return isArray(subject) || Buffer.isBuffer(subject) ||
      subject && typeof subject === 'object' &&
      typeof subject.length === 'number'
}

function toHex (n) {
  if (n < 16) return '0' + n.toString(16)
  return n.toString(16)
}

function utf8ToBytes (str) {
  var byteArray = []
  for (var i = 0; i < str.length; i++) {
    var b = str.charCodeAt(i)
    if (b <= 0x7F) {
      byteArray.push(b)
    } else {
      var start = i
      if (b >= 0xD800 && b <= 0xDFFF) i++
      var h = encodeURIComponent(str.slice(start, i+1)).substr(1).split('%')
      for (var j = 0; j < h.length; j++) {
        byteArray.push(parseInt(h[j], 16))
      }
    }
  }
  return byteArray
}

function asciiToBytes (str) {
  var byteArray = []
  for (var i = 0; i < str.length; i++) {
    // Node's code seems to be doing this and not & 0x7F..
    byteArray.push(str.charCodeAt(i) & 0xFF)
  }
  return byteArray
}

function utf16leToBytes (str) {
  var c, hi, lo
  var byteArray = []
  for (var i = 0; i < str.length; i++) {
    c = str.charCodeAt(i)
    hi = c >> 8
    lo = c % 256
    byteArray.push(lo)
    byteArray.push(hi)
  }

  return byteArray
}

function base64ToBytes (str) {
  return base64.toByteArray(str)
}

function blitBuffer (src, dst, offset, length) {
  for (var i = 0; i < length; i++) {
    if ((i + offset >= dst.length) || (i >= src.length))
      break
    dst[i + offset] = src[i]
  }
  return i
}

function decodeUtf8Char (str) {
  try {
    return decodeURIComponent(str)
  } catch (err) {
    return String.fromCharCode(0xFFFD) // UTF 8 invalid char
  }
}

},{"base64-js":8,"ieee754":9,"is-array":10}],8:[function(require,module,exports){
var lookup = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

;(function (exports) {
	'use strict';

  var Arr = (typeof Uint8Array !== 'undefined')
    ? Uint8Array
    : Array

	var PLUS   = '+'.charCodeAt(0)
	var SLASH  = '/'.charCodeAt(0)
	var NUMBER = '0'.charCodeAt(0)
	var LOWER  = 'a'.charCodeAt(0)
	var UPPER  = 'A'.charCodeAt(0)

	function decode (elt) {
		var code = elt.charCodeAt(0)
		if (code === PLUS)
			return 62 // '+'
		if (code === SLASH)
			return 63 // '/'
		if (code < NUMBER)
			return -1 //no match
		if (code < NUMBER + 10)
			return code - NUMBER + 26 + 26
		if (code < UPPER + 26)
			return code - UPPER
		if (code < LOWER + 26)
			return code - LOWER + 26
	}

	function b64ToByteArray (b64) {
		var i, j, l, tmp, placeHolders, arr

		if (b64.length % 4 > 0) {
			throw new Error('Invalid string. Length must be a multiple of 4')
		}

		// the number of equal signs (place holders)
		// if there are two placeholders, than the two characters before it
		// represent one byte
		// if there is only one, then the three characters before it represent 2 bytes
		// this is just a cheap hack to not do indexOf twice
		var len = b64.length
		placeHolders = '=' === b64.charAt(len - 2) ? 2 : '=' === b64.charAt(len - 1) ? 1 : 0

		// base64 is 4/3 + up to two characters of the original data
		arr = new Arr(b64.length * 3 / 4 - placeHolders)

		// if there are placeholders, only get up to the last complete 4 chars
		l = placeHolders > 0 ? b64.length - 4 : b64.length

		var L = 0

		function push (v) {
			arr[L++] = v
		}

		for (i = 0, j = 0; i < l; i += 4, j += 3) {
			tmp = (decode(b64.charAt(i)) << 18) | (decode(b64.charAt(i + 1)) << 12) | (decode(b64.charAt(i + 2)) << 6) | decode(b64.charAt(i + 3))
			push((tmp & 0xFF0000) >> 16)
			push((tmp & 0xFF00) >> 8)
			push(tmp & 0xFF)
		}

		if (placeHolders === 2) {
			tmp = (decode(b64.charAt(i)) << 2) | (decode(b64.charAt(i + 1)) >> 4)
			push(tmp & 0xFF)
		} else if (placeHolders === 1) {
			tmp = (decode(b64.charAt(i)) << 10) | (decode(b64.charAt(i + 1)) << 4) | (decode(b64.charAt(i + 2)) >> 2)
			push((tmp >> 8) & 0xFF)
			push(tmp & 0xFF)
		}

		return arr
	}

	function uint8ToBase64 (uint8) {
		var i,
			extraBytes = uint8.length % 3, // if we have 1 byte left, pad 2 bytes
			output = "",
			temp, length

		function encode (num) {
			return lookup.charAt(num)
		}

		function tripletToBase64 (num) {
			return encode(num >> 18 & 0x3F) + encode(num >> 12 & 0x3F) + encode(num >> 6 & 0x3F) + encode(num & 0x3F)
		}

		// go through the array every three bytes, we'll deal with trailing stuff later
		for (i = 0, length = uint8.length - extraBytes; i < length; i += 3) {
			temp = (uint8[i] << 16) + (uint8[i + 1] << 8) + (uint8[i + 2])
			output += tripletToBase64(temp)
		}

		// pad the end with zeros, but make sure to not forget the extra bytes
		switch (extraBytes) {
			case 1:
				temp = uint8[uint8.length - 1]
				output += encode(temp >> 2)
				output += encode((temp << 4) & 0x3F)
				output += '=='
				break
			case 2:
				temp = (uint8[uint8.length - 2] << 8) + (uint8[uint8.length - 1])
				output += encode(temp >> 10)
				output += encode((temp >> 4) & 0x3F)
				output += encode((temp << 2) & 0x3F)
				output += '='
				break
		}

		return output
	}

	exports.toByteArray = b64ToByteArray
	exports.fromByteArray = uint8ToBase64
}(typeof exports === 'undefined' ? (this.base64js = {}) : exports))

},{}],9:[function(require,module,exports){
exports.read = function(buffer, offset, isLE, mLen, nBytes) {
  var e, m,
      eLen = nBytes * 8 - mLen - 1,
      eMax = (1 << eLen) - 1,
      eBias = eMax >> 1,
      nBits = -7,
      i = isLE ? (nBytes - 1) : 0,
      d = isLE ? -1 : 1,
      s = buffer[offset + i];

  i += d;

  e = s & ((1 << (-nBits)) - 1);
  s >>= (-nBits);
  nBits += eLen;
  for (; nBits > 0; e = e * 256 + buffer[offset + i], i += d, nBits -= 8);

  m = e & ((1 << (-nBits)) - 1);
  e >>= (-nBits);
  nBits += mLen;
  for (; nBits > 0; m = m * 256 + buffer[offset + i], i += d, nBits -= 8);

  if (e === 0) {
    e = 1 - eBias;
  } else if (e === eMax) {
    return m ? NaN : ((s ? -1 : 1) * Infinity);
  } else {
    m = m + Math.pow(2, mLen);
    e = e - eBias;
  }
  return (s ? -1 : 1) * m * Math.pow(2, e - mLen);
};

exports.write = function(buffer, value, offset, isLE, mLen, nBytes) {
  var e, m, c,
      eLen = nBytes * 8 - mLen - 1,
      eMax = (1 << eLen) - 1,
      eBias = eMax >> 1,
      rt = (mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0),
      i = isLE ? 0 : (nBytes - 1),
      d = isLE ? 1 : -1,
      s = value < 0 || (value === 0 && 1 / value < 0) ? 1 : 0;

  value = Math.abs(value);

  if (isNaN(value) || value === Infinity) {
    m = isNaN(value) ? 1 : 0;
    e = eMax;
  } else {
    e = Math.floor(Math.log(value) / Math.LN2);
    if (value * (c = Math.pow(2, -e)) < 1) {
      e--;
      c *= 2;
    }
    if (e + eBias >= 1) {
      value += rt / c;
    } else {
      value += rt * Math.pow(2, 1 - eBias);
    }
    if (value * c >= 2) {
      e++;
      c /= 2;
    }

    if (e + eBias >= eMax) {
      m = 0;
      e = eMax;
    } else if (e + eBias >= 1) {
      m = (value * c - 1) * Math.pow(2, mLen);
      e = e + eBias;
    } else {
      m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen);
      e = 0;
    }
  }

  for (; mLen >= 8; buffer[offset + i] = m & 0xff, i += d, m /= 256, mLen -= 8);

  e = (e << mLen) | m;
  eLen += mLen;
  for (; eLen > 0; buffer[offset + i] = e & 0xff, i += d, e /= 256, eLen -= 8);

  buffer[offset + i - d] |= s * 128;
};

},{}],10:[function(require,module,exports){

/**
 * isArray
 */

var isArray = Array.isArray;

/**
 * toString
 */

var str = Object.prototype.toString;

/**
 * Whether or not the given `val`
 * is an array.
 *
 * example:
 *
 *        isArray([]);
 *        // > true
 *        isArray(arguments);
 *        // > false
 *        isArray('');
 *        // > false
 *
 * @param {mixed} val
 * @return {bool}
 */

module.exports = isArray || function (val) {
  return !! val && '[object Array]' == str.call(val);
};

},{}],11:[function(require,module,exports){
// shim for using process in browser

var process = module.exports = {};

process.nextTick = (function () {
    var canSetImmediate = typeof window !== 'undefined'
    && window.setImmediate;
    var canMutationObserver = typeof window !== 'undefined'
    && window.MutationObserver;
    var canPost = typeof window !== 'undefined'
    && window.postMessage && window.addEventListener
    ;

    if (canSetImmediate) {
        return function (f) { return window.setImmediate(f) };
    }

    var queue = [];

    if (canMutationObserver) {
        var hiddenDiv = document.createElement("div");
        var observer = new MutationObserver(function () {
            var queueList = queue.slice();
            queue.length = 0;
            queueList.forEach(function (fn) {
                fn();
            });
        });

        observer.observe(hiddenDiv, { attributes: true });

        return function nextTick(fn) {
            if (!queue.length) {
                hiddenDiv.setAttribute('yes', 'no');
            }
            queue.push(fn);
        };
    }

    if (canPost) {
        window.addEventListener('message', function (ev) {
            var source = ev.source;
            if ((source === window || source === null) && ev.data === 'process-tick') {
                ev.stopPropagation();
                if (queue.length > 0) {
                    var fn = queue.shift();
                    fn();
                }
            }
        }, true);

        return function nextTick(fn) {
            queue.push(fn);
            window.postMessage('process-tick', '*');
        };
    }

    return function nextTick(fn) {
        setTimeout(fn, 0);
    };
})();

process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

// TODO(shtylman)
process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};

},{}]},{},[6])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uL3Vzci9sb2NhbC9saWIvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXItcGFjay9fcHJlbHVkZS5qcyIsIm5vZGVfbW9kdWxlcy9hc3luYy9saWIvYXN5bmMuanMiLCJub2RlX21vZHVsZXMvYnJvd3Nlci1zZXJpYWxwb3J0L2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL2ludGVsLWhleC9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9zdGs1MDAvbGliL3N0azUwMC5qcyIsIm5vZGVfbW9kdWxlcy9zdGs1MDAvbm9kZV9tb2R1bGVzL2J1ZmZlci1lcXVhbC9pbmRleC5qcyIsInN0azUwMC5qcyIsIi4uLy4uLy4uLy4uL3Vzci9sb2NhbC9saWIvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2J1ZmZlci9pbmRleC5qcyIsIi4uLy4uLy4uLy4uL3Vzci9sb2NhbC9saWIvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2J1ZmZlci9ub2RlX21vZHVsZXMvYmFzZTY0LWpzL2xpYi9iNjQuanMiLCIuLi8uLi8uLi8uLi91c3IvbG9jYWwvbGliL25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9idWZmZXIvbm9kZV9tb2R1bGVzL2llZWU3NTQvaW5kZXguanMiLCIuLi8uLi8uLi8uLi91c3IvbG9jYWwvbGliL25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9idWZmZXIvbm9kZV9tb2R1bGVzL2lzLWFycmF5L2luZGV4LmpzIiwiLi4vLi4vLi4vLi4vdXNyL2xvY2FsL2xpYi9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvcHJvY2Vzcy9icm93c2VyLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcm1DQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcE5BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3ZJQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDclZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNkQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbEdBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDM2hDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4SEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcEZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2pDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiKGZ1bmN0aW9uIChwcm9jZXNzKXtcbi8qIVxuICogYXN5bmNcbiAqIGh0dHBzOi8vZ2l0aHViLmNvbS9jYW9sYW4vYXN5bmNcbiAqXG4gKiBDb3B5cmlnaHQgMjAxMC0yMDE0IENhb2xhbiBNY01haG9uXG4gKiBSZWxlYXNlZCB1bmRlciB0aGUgTUlUIGxpY2Vuc2VcbiAqL1xuLypqc2hpbnQgb25ldmFyOiBmYWxzZSwgaW5kZW50OjQgKi9cbi8qZ2xvYmFsIHNldEltbWVkaWF0ZTogZmFsc2UsIHNldFRpbWVvdXQ6IGZhbHNlLCBjb25zb2xlOiBmYWxzZSAqL1xuKGZ1bmN0aW9uICgpIHtcblxuICAgIHZhciBhc3luYyA9IHt9O1xuXG4gICAgLy8gZ2xvYmFsIG9uIHRoZSBzZXJ2ZXIsIHdpbmRvdyBpbiB0aGUgYnJvd3NlclxuICAgIHZhciByb290LCBwcmV2aW91c19hc3luYztcblxuICAgIHJvb3QgPSB0aGlzO1xuICAgIGlmIChyb290ICE9IG51bGwpIHtcbiAgICAgIHByZXZpb3VzX2FzeW5jID0gcm9vdC5hc3luYztcbiAgICB9XG5cbiAgICBhc3luYy5ub0NvbmZsaWN0ID0gZnVuY3Rpb24gKCkge1xuICAgICAgICByb290LmFzeW5jID0gcHJldmlvdXNfYXN5bmM7XG4gICAgICAgIHJldHVybiBhc3luYztcbiAgICB9O1xuXG4gICAgZnVuY3Rpb24gb25seV9vbmNlKGZuKSB7XG4gICAgICAgIHZhciBjYWxsZWQgPSBmYWxzZTtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgaWYgKGNhbGxlZCkgdGhyb3cgbmV3IEVycm9yKFwiQ2FsbGJhY2sgd2FzIGFscmVhZHkgY2FsbGVkLlwiKTtcbiAgICAgICAgICAgIGNhbGxlZCA9IHRydWU7XG4gICAgICAgICAgICBmbi5hcHBseShyb290LCBhcmd1bWVudHMpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8vLyBjcm9zcy1icm93c2VyIGNvbXBhdGlibGl0eSBmdW5jdGlvbnMgLy8vL1xuXG4gICAgdmFyIF90b1N0cmluZyA9IE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmc7XG5cbiAgICB2YXIgX2lzQXJyYXkgPSBBcnJheS5pc0FycmF5IHx8IGZ1bmN0aW9uIChvYmopIHtcbiAgICAgICAgcmV0dXJuIF90b1N0cmluZy5jYWxsKG9iaikgPT09ICdbb2JqZWN0IEFycmF5XSc7XG4gICAgfTtcblxuICAgIHZhciBfZWFjaCA9IGZ1bmN0aW9uIChhcnIsIGl0ZXJhdG9yKSB7XG4gICAgICAgIGlmIChhcnIuZm9yRWFjaCkge1xuICAgICAgICAgICAgcmV0dXJuIGFyci5mb3JFYWNoKGl0ZXJhdG9yKTtcbiAgICAgICAgfVxuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGFyci5sZW5ndGg7IGkgKz0gMSkge1xuICAgICAgICAgICAgaXRlcmF0b3IoYXJyW2ldLCBpLCBhcnIpO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIHZhciBfbWFwID0gZnVuY3Rpb24gKGFyciwgaXRlcmF0b3IpIHtcbiAgICAgICAgaWYgKGFyci5tYXApIHtcbiAgICAgICAgICAgIHJldHVybiBhcnIubWFwKGl0ZXJhdG9yKTtcbiAgICAgICAgfVxuICAgICAgICB2YXIgcmVzdWx0cyA9IFtdO1xuICAgICAgICBfZWFjaChhcnIsIGZ1bmN0aW9uICh4LCBpLCBhKSB7XG4gICAgICAgICAgICByZXN1bHRzLnB1c2goaXRlcmF0b3IoeCwgaSwgYSkpO1xuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuIHJlc3VsdHM7XG4gICAgfTtcblxuICAgIHZhciBfcmVkdWNlID0gZnVuY3Rpb24gKGFyciwgaXRlcmF0b3IsIG1lbW8pIHtcbiAgICAgICAgaWYgKGFyci5yZWR1Y2UpIHtcbiAgICAgICAgICAgIHJldHVybiBhcnIucmVkdWNlKGl0ZXJhdG9yLCBtZW1vKTtcbiAgICAgICAgfVxuICAgICAgICBfZWFjaChhcnIsIGZ1bmN0aW9uICh4LCBpLCBhKSB7XG4gICAgICAgICAgICBtZW1vID0gaXRlcmF0b3IobWVtbywgeCwgaSwgYSk7XG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gbWVtbztcbiAgICB9O1xuXG4gICAgdmFyIF9rZXlzID0gZnVuY3Rpb24gKG9iaikge1xuICAgICAgICBpZiAoT2JqZWN0LmtleXMpIHtcbiAgICAgICAgICAgIHJldHVybiBPYmplY3Qua2V5cyhvYmopO1xuICAgICAgICB9XG4gICAgICAgIHZhciBrZXlzID0gW107XG4gICAgICAgIGZvciAodmFyIGsgaW4gb2JqKSB7XG4gICAgICAgICAgICBpZiAob2JqLmhhc093blByb3BlcnR5KGspKSB7XG4gICAgICAgICAgICAgICAga2V5cy5wdXNoKGspO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBrZXlzO1xuICAgIH07XG5cbiAgICAvLy8vIGV4cG9ydGVkIGFzeW5jIG1vZHVsZSBmdW5jdGlvbnMgLy8vL1xuXG4gICAgLy8vLyBuZXh0VGljayBpbXBsZW1lbnRhdGlvbiB3aXRoIGJyb3dzZXItY29tcGF0aWJsZSBmYWxsYmFjayAvLy8vXG4gICAgaWYgKHR5cGVvZiBwcm9jZXNzID09PSAndW5kZWZpbmVkJyB8fCAhKHByb2Nlc3MubmV4dFRpY2spKSB7XG4gICAgICAgIGlmICh0eXBlb2Ygc2V0SW1tZWRpYXRlID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgICBhc3luYy5uZXh0VGljayA9IGZ1bmN0aW9uIChmbikge1xuICAgICAgICAgICAgICAgIC8vIG5vdCBhIGRpcmVjdCBhbGlhcyBmb3IgSUUxMCBjb21wYXRpYmlsaXR5XG4gICAgICAgICAgICAgICAgc2V0SW1tZWRpYXRlKGZuKTtcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICBhc3luYy5zZXRJbW1lZGlhdGUgPSBhc3luYy5uZXh0VGljaztcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIGFzeW5jLm5leHRUaWNrID0gZnVuY3Rpb24gKGZuKSB7XG4gICAgICAgICAgICAgICAgc2V0VGltZW91dChmbiwgMCk7XG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgYXN5bmMuc2V0SW1tZWRpYXRlID0gYXN5bmMubmV4dFRpY2s7XG4gICAgICAgIH1cbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICAgIGFzeW5jLm5leHRUaWNrID0gcHJvY2Vzcy5uZXh0VGljaztcbiAgICAgICAgaWYgKHR5cGVvZiBzZXRJbW1lZGlhdGUgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgICBhc3luYy5zZXRJbW1lZGlhdGUgPSBmdW5jdGlvbiAoZm4pIHtcbiAgICAgICAgICAgICAgLy8gbm90IGEgZGlyZWN0IGFsaWFzIGZvciBJRTEwIGNvbXBhdGliaWxpdHlcbiAgICAgICAgICAgICAgc2V0SW1tZWRpYXRlKGZuKTtcbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICBhc3luYy5zZXRJbW1lZGlhdGUgPSBhc3luYy5uZXh0VGljaztcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGFzeW5jLmVhY2ggPSBmdW5jdGlvbiAoYXJyLCBpdGVyYXRvciwgY2FsbGJhY2spIHtcbiAgICAgICAgY2FsbGJhY2sgPSBjYWxsYmFjayB8fCBmdW5jdGlvbiAoKSB7fTtcbiAgICAgICAgaWYgKCFhcnIubGVuZ3RoKSB7XG4gICAgICAgICAgICByZXR1cm4gY2FsbGJhY2soKTtcbiAgICAgICAgfVxuICAgICAgICB2YXIgY29tcGxldGVkID0gMDtcbiAgICAgICAgX2VhY2goYXJyLCBmdW5jdGlvbiAoeCkge1xuICAgICAgICAgICAgaXRlcmF0b3IoeCwgb25seV9vbmNlKGRvbmUpICk7XG4gICAgICAgIH0pO1xuICAgICAgICBmdW5jdGlvbiBkb25lKGVycikge1xuICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgY2FsbGJhY2soZXJyKTtcbiAgICAgICAgICAgICAgY2FsbGJhY2sgPSBmdW5jdGlvbiAoKSB7fTtcbiAgICAgICAgICB9XG4gICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgIGNvbXBsZXRlZCArPSAxO1xuICAgICAgICAgICAgICBpZiAoY29tcGxldGVkID49IGFyci5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICAgIGNhbGxiYWNrKCk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9O1xuICAgIGFzeW5jLmZvckVhY2ggPSBhc3luYy5lYWNoO1xuXG4gICAgYXN5bmMuZWFjaFNlcmllcyA9IGZ1bmN0aW9uIChhcnIsIGl0ZXJhdG9yLCBjYWxsYmFjaykge1xuICAgICAgICBjYWxsYmFjayA9IGNhbGxiYWNrIHx8IGZ1bmN0aW9uICgpIHt9O1xuICAgICAgICBpZiAoIWFyci5sZW5ndGgpIHtcbiAgICAgICAgICAgIHJldHVybiBjYWxsYmFjaygpO1xuICAgICAgICB9XG4gICAgICAgIHZhciBjb21wbGV0ZWQgPSAwO1xuICAgICAgICB2YXIgaXRlcmF0ZSA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIGl0ZXJhdG9yKGFycltjb21wbGV0ZWRdLCBmdW5jdGlvbiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICAgICAgICBjYWxsYmFjayhlcnIpO1xuICAgICAgICAgICAgICAgICAgICBjYWxsYmFjayA9IGZ1bmN0aW9uICgpIHt9O1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgY29tcGxldGVkICs9IDE7XG4gICAgICAgICAgICAgICAgICAgIGlmIChjb21wbGV0ZWQgPj0gYXJyLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2soKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGl0ZXJhdGUoKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9O1xuICAgICAgICBpdGVyYXRlKCk7XG4gICAgfTtcbiAgICBhc3luYy5mb3JFYWNoU2VyaWVzID0gYXN5bmMuZWFjaFNlcmllcztcblxuICAgIGFzeW5jLmVhY2hMaW1pdCA9IGZ1bmN0aW9uIChhcnIsIGxpbWl0LCBpdGVyYXRvciwgY2FsbGJhY2spIHtcbiAgICAgICAgdmFyIGZuID0gX2VhY2hMaW1pdChsaW1pdCk7XG4gICAgICAgIGZuLmFwcGx5KG51bGwsIFthcnIsIGl0ZXJhdG9yLCBjYWxsYmFja10pO1xuICAgIH07XG4gICAgYXN5bmMuZm9yRWFjaExpbWl0ID0gYXN5bmMuZWFjaExpbWl0O1xuXG4gICAgdmFyIF9lYWNoTGltaXQgPSBmdW5jdGlvbiAobGltaXQpIHtcblxuICAgICAgICByZXR1cm4gZnVuY3Rpb24gKGFyciwgaXRlcmF0b3IsIGNhbGxiYWNrKSB7XG4gICAgICAgICAgICBjYWxsYmFjayA9IGNhbGxiYWNrIHx8IGZ1bmN0aW9uICgpIHt9O1xuICAgICAgICAgICAgaWYgKCFhcnIubGVuZ3RoIHx8IGxpbWl0IDw9IDApIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gY2FsbGJhY2soKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHZhciBjb21wbGV0ZWQgPSAwO1xuICAgICAgICAgICAgdmFyIHN0YXJ0ZWQgPSAwO1xuICAgICAgICAgICAgdmFyIHJ1bm5pbmcgPSAwO1xuXG4gICAgICAgICAgICAoZnVuY3Rpb24gcmVwbGVuaXNoICgpIHtcbiAgICAgICAgICAgICAgICBpZiAoY29tcGxldGVkID49IGFyci5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGNhbGxiYWNrKCk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgd2hpbGUgKHJ1bm5pbmcgPCBsaW1pdCAmJiBzdGFydGVkIDwgYXJyLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgICAgICBzdGFydGVkICs9IDE7XG4gICAgICAgICAgICAgICAgICAgIHJ1bm5pbmcgKz0gMTtcbiAgICAgICAgICAgICAgICAgICAgaXRlcmF0b3IoYXJyW3N0YXJ0ZWQgLSAxXSwgZnVuY3Rpb24gKGVycikge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrKGVycik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2sgPSBmdW5jdGlvbiAoKSB7fTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbXBsZXRlZCArPSAxO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJ1bm5pbmcgLT0gMTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoY29tcGxldGVkID49IGFyci5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2soKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlcGxlbmlzaCgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSkoKTtcbiAgICAgICAgfTtcbiAgICB9O1xuXG5cbiAgICB2YXIgZG9QYXJhbGxlbCA9IGZ1bmN0aW9uIChmbikge1xuICAgICAgICByZXR1cm4gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgdmFyIGFyZ3MgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMpO1xuICAgICAgICAgICAgcmV0dXJuIGZuLmFwcGx5KG51bGwsIFthc3luYy5lYWNoXS5jb25jYXQoYXJncykpO1xuICAgICAgICB9O1xuICAgIH07XG4gICAgdmFyIGRvUGFyYWxsZWxMaW1pdCA9IGZ1bmN0aW9uKGxpbWl0LCBmbikge1xuICAgICAgICByZXR1cm4gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgdmFyIGFyZ3MgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMpO1xuICAgICAgICAgICAgcmV0dXJuIGZuLmFwcGx5KG51bGwsIFtfZWFjaExpbWl0KGxpbWl0KV0uY29uY2F0KGFyZ3MpKTtcbiAgICAgICAgfTtcbiAgICB9O1xuICAgIHZhciBkb1NlcmllcyA9IGZ1bmN0aW9uIChmbikge1xuICAgICAgICByZXR1cm4gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgdmFyIGFyZ3MgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMpO1xuICAgICAgICAgICAgcmV0dXJuIGZuLmFwcGx5KG51bGwsIFthc3luYy5lYWNoU2VyaWVzXS5jb25jYXQoYXJncykpO1xuICAgICAgICB9O1xuICAgIH07XG5cblxuICAgIHZhciBfYXN5bmNNYXAgPSBmdW5jdGlvbiAoZWFjaGZuLCBhcnIsIGl0ZXJhdG9yLCBjYWxsYmFjaykge1xuICAgICAgICBhcnIgPSBfbWFwKGFyciwgZnVuY3Rpb24gKHgsIGkpIHtcbiAgICAgICAgICAgIHJldHVybiB7aW5kZXg6IGksIHZhbHVlOiB4fTtcbiAgICAgICAgfSk7XG4gICAgICAgIGlmICghY2FsbGJhY2spIHtcbiAgICAgICAgICAgIGVhY2hmbihhcnIsIGZ1bmN0aW9uICh4LCBjYWxsYmFjaykge1xuICAgICAgICAgICAgICAgIGl0ZXJhdG9yKHgudmFsdWUsIGZ1bmN0aW9uIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2soZXJyKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdmFyIHJlc3VsdHMgPSBbXTtcbiAgICAgICAgICAgIGVhY2hmbihhcnIsIGZ1bmN0aW9uICh4LCBjYWxsYmFjaykge1xuICAgICAgICAgICAgICAgIGl0ZXJhdG9yKHgudmFsdWUsIGZ1bmN0aW9uIChlcnIsIHYpIHtcbiAgICAgICAgICAgICAgICAgICAgcmVzdWx0c1t4LmluZGV4XSA9IHY7XG4gICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrKGVycik7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9LCBmdW5jdGlvbiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgY2FsbGJhY2soZXJyLCByZXN1bHRzKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgfTtcbiAgICBhc3luYy5tYXAgPSBkb1BhcmFsbGVsKF9hc3luY01hcCk7XG4gICAgYXN5bmMubWFwU2VyaWVzID0gZG9TZXJpZXMoX2FzeW5jTWFwKTtcbiAgICBhc3luYy5tYXBMaW1pdCA9IGZ1bmN0aW9uIChhcnIsIGxpbWl0LCBpdGVyYXRvciwgY2FsbGJhY2spIHtcbiAgICAgICAgcmV0dXJuIF9tYXBMaW1pdChsaW1pdCkoYXJyLCBpdGVyYXRvciwgY2FsbGJhY2spO1xuICAgIH07XG5cbiAgICB2YXIgX21hcExpbWl0ID0gZnVuY3Rpb24obGltaXQpIHtcbiAgICAgICAgcmV0dXJuIGRvUGFyYWxsZWxMaW1pdChsaW1pdCwgX2FzeW5jTWFwKTtcbiAgICB9O1xuXG4gICAgLy8gcmVkdWNlIG9ubHkgaGFzIGEgc2VyaWVzIHZlcnNpb24sIGFzIGRvaW5nIHJlZHVjZSBpbiBwYXJhbGxlbCB3b24ndFxuICAgIC8vIHdvcmsgaW4gbWFueSBzaXR1YXRpb25zLlxuICAgIGFzeW5jLnJlZHVjZSA9IGZ1bmN0aW9uIChhcnIsIG1lbW8sIGl0ZXJhdG9yLCBjYWxsYmFjaykge1xuICAgICAgICBhc3luYy5lYWNoU2VyaWVzKGFyciwgZnVuY3Rpb24gKHgsIGNhbGxiYWNrKSB7XG4gICAgICAgICAgICBpdGVyYXRvcihtZW1vLCB4LCBmdW5jdGlvbiAoZXJyLCB2KSB7XG4gICAgICAgICAgICAgICAgbWVtbyA9IHY7XG4gICAgICAgICAgICAgICAgY2FsbGJhY2soZXJyKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9LCBmdW5jdGlvbiAoZXJyKSB7XG4gICAgICAgICAgICBjYWxsYmFjayhlcnIsIG1lbW8pO1xuICAgICAgICB9KTtcbiAgICB9O1xuICAgIC8vIGluamVjdCBhbGlhc1xuICAgIGFzeW5jLmluamVjdCA9IGFzeW5jLnJlZHVjZTtcbiAgICAvLyBmb2xkbCBhbGlhc1xuICAgIGFzeW5jLmZvbGRsID0gYXN5bmMucmVkdWNlO1xuXG4gICAgYXN5bmMucmVkdWNlUmlnaHQgPSBmdW5jdGlvbiAoYXJyLCBtZW1vLCBpdGVyYXRvciwgY2FsbGJhY2spIHtcbiAgICAgICAgdmFyIHJldmVyc2VkID0gX21hcChhcnIsIGZ1bmN0aW9uICh4KSB7XG4gICAgICAgICAgICByZXR1cm4geDtcbiAgICAgICAgfSkucmV2ZXJzZSgpO1xuICAgICAgICBhc3luYy5yZWR1Y2UocmV2ZXJzZWQsIG1lbW8sIGl0ZXJhdG9yLCBjYWxsYmFjayk7XG4gICAgfTtcbiAgICAvLyBmb2xkciBhbGlhc1xuICAgIGFzeW5jLmZvbGRyID0gYXN5bmMucmVkdWNlUmlnaHQ7XG5cbiAgICB2YXIgX2ZpbHRlciA9IGZ1bmN0aW9uIChlYWNoZm4sIGFyciwgaXRlcmF0b3IsIGNhbGxiYWNrKSB7XG4gICAgICAgIHZhciByZXN1bHRzID0gW107XG4gICAgICAgIGFyciA9IF9tYXAoYXJyLCBmdW5jdGlvbiAoeCwgaSkge1xuICAgICAgICAgICAgcmV0dXJuIHtpbmRleDogaSwgdmFsdWU6IHh9O1xuICAgICAgICB9KTtcbiAgICAgICAgZWFjaGZuKGFyciwgZnVuY3Rpb24gKHgsIGNhbGxiYWNrKSB7XG4gICAgICAgICAgICBpdGVyYXRvcih4LnZhbHVlLCBmdW5jdGlvbiAodikge1xuICAgICAgICAgICAgICAgIGlmICh2KSB7XG4gICAgICAgICAgICAgICAgICAgIHJlc3VsdHMucHVzaCh4KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgY2FsbGJhY2soKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9LCBmdW5jdGlvbiAoZXJyKSB7XG4gICAgICAgICAgICBjYWxsYmFjayhfbWFwKHJlc3VsdHMuc29ydChmdW5jdGlvbiAoYSwgYikge1xuICAgICAgICAgICAgICAgIHJldHVybiBhLmluZGV4IC0gYi5pbmRleDtcbiAgICAgICAgICAgIH0pLCBmdW5jdGlvbiAoeCkge1xuICAgICAgICAgICAgICAgIHJldHVybiB4LnZhbHVlO1xuICAgICAgICAgICAgfSkpO1xuICAgICAgICB9KTtcbiAgICB9O1xuICAgIGFzeW5jLmZpbHRlciA9IGRvUGFyYWxsZWwoX2ZpbHRlcik7XG4gICAgYXN5bmMuZmlsdGVyU2VyaWVzID0gZG9TZXJpZXMoX2ZpbHRlcik7XG4gICAgLy8gc2VsZWN0IGFsaWFzXG4gICAgYXN5bmMuc2VsZWN0ID0gYXN5bmMuZmlsdGVyO1xuICAgIGFzeW5jLnNlbGVjdFNlcmllcyA9IGFzeW5jLmZpbHRlclNlcmllcztcblxuICAgIHZhciBfcmVqZWN0ID0gZnVuY3Rpb24gKGVhY2hmbiwgYXJyLCBpdGVyYXRvciwgY2FsbGJhY2spIHtcbiAgICAgICAgdmFyIHJlc3VsdHMgPSBbXTtcbiAgICAgICAgYXJyID0gX21hcChhcnIsIGZ1bmN0aW9uICh4LCBpKSB7XG4gICAgICAgICAgICByZXR1cm4ge2luZGV4OiBpLCB2YWx1ZTogeH07XG4gICAgICAgIH0pO1xuICAgICAgICBlYWNoZm4oYXJyLCBmdW5jdGlvbiAoeCwgY2FsbGJhY2spIHtcbiAgICAgICAgICAgIGl0ZXJhdG9yKHgudmFsdWUsIGZ1bmN0aW9uICh2KSB7XG4gICAgICAgICAgICAgICAgaWYgKCF2KSB7XG4gICAgICAgICAgICAgICAgICAgIHJlc3VsdHMucHVzaCh4KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgY2FsbGJhY2soKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9LCBmdW5jdGlvbiAoZXJyKSB7XG4gICAgICAgICAgICBjYWxsYmFjayhfbWFwKHJlc3VsdHMuc29ydChmdW5jdGlvbiAoYSwgYikge1xuICAgICAgICAgICAgICAgIHJldHVybiBhLmluZGV4IC0gYi5pbmRleDtcbiAgICAgICAgICAgIH0pLCBmdW5jdGlvbiAoeCkge1xuICAgICAgICAgICAgICAgIHJldHVybiB4LnZhbHVlO1xuICAgICAgICAgICAgfSkpO1xuICAgICAgICB9KTtcbiAgICB9O1xuICAgIGFzeW5jLnJlamVjdCA9IGRvUGFyYWxsZWwoX3JlamVjdCk7XG4gICAgYXN5bmMucmVqZWN0U2VyaWVzID0gZG9TZXJpZXMoX3JlamVjdCk7XG5cbiAgICB2YXIgX2RldGVjdCA9IGZ1bmN0aW9uIChlYWNoZm4sIGFyciwgaXRlcmF0b3IsIG1haW5fY2FsbGJhY2spIHtcbiAgICAgICAgZWFjaGZuKGFyciwgZnVuY3Rpb24gKHgsIGNhbGxiYWNrKSB7XG4gICAgICAgICAgICBpdGVyYXRvcih4LCBmdW5jdGlvbiAocmVzdWx0KSB7XG4gICAgICAgICAgICAgICAgaWYgKHJlc3VsdCkge1xuICAgICAgICAgICAgICAgICAgICBtYWluX2NhbGxiYWNrKHgpO1xuICAgICAgICAgICAgICAgICAgICBtYWluX2NhbGxiYWNrID0gZnVuY3Rpb24gKCkge307XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBjYWxsYmFjaygpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9LCBmdW5jdGlvbiAoZXJyKSB7XG4gICAgICAgICAgICBtYWluX2NhbGxiYWNrKCk7XG4gICAgICAgIH0pO1xuICAgIH07XG4gICAgYXN5bmMuZGV0ZWN0ID0gZG9QYXJhbGxlbChfZGV0ZWN0KTtcbiAgICBhc3luYy5kZXRlY3RTZXJpZXMgPSBkb1NlcmllcyhfZGV0ZWN0KTtcblxuICAgIGFzeW5jLnNvbWUgPSBmdW5jdGlvbiAoYXJyLCBpdGVyYXRvciwgbWFpbl9jYWxsYmFjaykge1xuICAgICAgICBhc3luYy5lYWNoKGFyciwgZnVuY3Rpb24gKHgsIGNhbGxiYWNrKSB7XG4gICAgICAgICAgICBpdGVyYXRvcih4LCBmdW5jdGlvbiAodikge1xuICAgICAgICAgICAgICAgIGlmICh2KSB7XG4gICAgICAgICAgICAgICAgICAgIG1haW5fY2FsbGJhY2sodHJ1ZSk7XG4gICAgICAgICAgICAgICAgICAgIG1haW5fY2FsbGJhY2sgPSBmdW5jdGlvbiAoKSB7fTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgY2FsbGJhY2soKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9LCBmdW5jdGlvbiAoZXJyKSB7XG4gICAgICAgICAgICBtYWluX2NhbGxiYWNrKGZhbHNlKTtcbiAgICAgICAgfSk7XG4gICAgfTtcbiAgICAvLyBhbnkgYWxpYXNcbiAgICBhc3luYy5hbnkgPSBhc3luYy5zb21lO1xuXG4gICAgYXN5bmMuZXZlcnkgPSBmdW5jdGlvbiAoYXJyLCBpdGVyYXRvciwgbWFpbl9jYWxsYmFjaykge1xuICAgICAgICBhc3luYy5lYWNoKGFyciwgZnVuY3Rpb24gKHgsIGNhbGxiYWNrKSB7XG4gICAgICAgICAgICBpdGVyYXRvcih4LCBmdW5jdGlvbiAodikge1xuICAgICAgICAgICAgICAgIGlmICghdikge1xuICAgICAgICAgICAgICAgICAgICBtYWluX2NhbGxiYWNrKGZhbHNlKTtcbiAgICAgICAgICAgICAgICAgICAgbWFpbl9jYWxsYmFjayA9IGZ1bmN0aW9uICgpIHt9O1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBjYWxsYmFjaygpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0sIGZ1bmN0aW9uIChlcnIpIHtcbiAgICAgICAgICAgIG1haW5fY2FsbGJhY2sodHJ1ZSk7XG4gICAgICAgIH0pO1xuICAgIH07XG4gICAgLy8gYWxsIGFsaWFzXG4gICAgYXN5bmMuYWxsID0gYXN5bmMuZXZlcnk7XG5cbiAgICBhc3luYy5zb3J0QnkgPSBmdW5jdGlvbiAoYXJyLCBpdGVyYXRvciwgY2FsbGJhY2spIHtcbiAgICAgICAgYXN5bmMubWFwKGFyciwgZnVuY3Rpb24gKHgsIGNhbGxiYWNrKSB7XG4gICAgICAgICAgICBpdGVyYXRvcih4LCBmdW5jdGlvbiAoZXJyLCBjcml0ZXJpYSkge1xuICAgICAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2soZXJyKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrKG51bGwsIHt2YWx1ZTogeCwgY3JpdGVyaWE6IGNyaXRlcmlhfSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0sIGZ1bmN0aW9uIChlcnIsIHJlc3VsdHMpIHtcbiAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gY2FsbGJhY2soZXJyKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIHZhciBmbiA9IGZ1bmN0aW9uIChsZWZ0LCByaWdodCkge1xuICAgICAgICAgICAgICAgICAgICB2YXIgYSA9IGxlZnQuY3JpdGVyaWEsIGIgPSByaWdodC5jcml0ZXJpYTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGEgPCBiID8gLTEgOiBhID4gYiA/IDEgOiAwO1xuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgY2FsbGJhY2sobnVsbCwgX21hcChyZXN1bHRzLnNvcnQoZm4pLCBmdW5jdGlvbiAoeCkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4geC52YWx1ZTtcbiAgICAgICAgICAgICAgICB9KSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgIH07XG5cbiAgICBhc3luYy5hdXRvID0gZnVuY3Rpb24gKHRhc2tzLCBjYWxsYmFjaykge1xuICAgICAgICBjYWxsYmFjayA9IGNhbGxiYWNrIHx8IGZ1bmN0aW9uICgpIHt9O1xuICAgICAgICB2YXIga2V5cyA9IF9rZXlzKHRhc2tzKTtcbiAgICAgICAgdmFyIHJlbWFpbmluZ1Rhc2tzID0ga2V5cy5sZW5ndGhcbiAgICAgICAgaWYgKCFyZW1haW5pbmdUYXNrcykge1xuICAgICAgICAgICAgcmV0dXJuIGNhbGxiYWNrKCk7XG4gICAgICAgIH1cblxuICAgICAgICB2YXIgcmVzdWx0cyA9IHt9O1xuXG4gICAgICAgIHZhciBsaXN0ZW5lcnMgPSBbXTtcbiAgICAgICAgdmFyIGFkZExpc3RlbmVyID0gZnVuY3Rpb24gKGZuKSB7XG4gICAgICAgICAgICBsaXN0ZW5lcnMudW5zaGlmdChmbik7XG4gICAgICAgIH07XG4gICAgICAgIHZhciByZW1vdmVMaXN0ZW5lciA9IGZ1bmN0aW9uIChmbikge1xuICAgICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBsaXN0ZW5lcnMubGVuZ3RoOyBpICs9IDEpIHtcbiAgICAgICAgICAgICAgICBpZiAobGlzdGVuZXJzW2ldID09PSBmbikge1xuICAgICAgICAgICAgICAgICAgICBsaXN0ZW5lcnMuc3BsaWNlKGksIDEpO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuICAgICAgICB2YXIgdGFza0NvbXBsZXRlID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgcmVtYWluaW5nVGFza3MtLVxuICAgICAgICAgICAgX2VhY2gobGlzdGVuZXJzLnNsaWNlKDApLCBmdW5jdGlvbiAoZm4pIHtcbiAgICAgICAgICAgICAgICBmbigpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH07XG5cbiAgICAgICAgYWRkTGlzdGVuZXIoZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgaWYgKCFyZW1haW5pbmdUYXNrcykge1xuICAgICAgICAgICAgICAgIHZhciB0aGVDYWxsYmFjayA9IGNhbGxiYWNrO1xuICAgICAgICAgICAgICAgIC8vIHByZXZlbnQgZmluYWwgY2FsbGJhY2sgZnJvbSBjYWxsaW5nIGl0c2VsZiBpZiBpdCBlcnJvcnNcbiAgICAgICAgICAgICAgICBjYWxsYmFjayA9IGZ1bmN0aW9uICgpIHt9O1xuXG4gICAgICAgICAgICAgICAgdGhlQ2FsbGJhY2sobnVsbCwgcmVzdWx0cyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuXG4gICAgICAgIF9lYWNoKGtleXMsIGZ1bmN0aW9uIChrKSB7XG4gICAgICAgICAgICB2YXIgdGFzayA9IF9pc0FycmF5KHRhc2tzW2tdKSA/IHRhc2tzW2tdOiBbdGFza3Nba11dO1xuICAgICAgICAgICAgdmFyIHRhc2tDYWxsYmFjayA9IGZ1bmN0aW9uIChlcnIpIHtcbiAgICAgICAgICAgICAgICB2YXIgYXJncyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMSk7XG4gICAgICAgICAgICAgICAgaWYgKGFyZ3MubGVuZ3RoIDw9IDEpIHtcbiAgICAgICAgICAgICAgICAgICAgYXJncyA9IGFyZ3NbMF07XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIHNhZmVSZXN1bHRzID0ge307XG4gICAgICAgICAgICAgICAgICAgIF9lYWNoKF9rZXlzKHJlc3VsdHMpLCBmdW5jdGlvbihya2V5KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzYWZlUmVzdWx0c1tya2V5XSA9IHJlc3VsdHNbcmtleV07XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICBzYWZlUmVzdWx0c1trXSA9IGFyZ3M7XG4gICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrKGVyciwgc2FmZVJlc3VsdHMpO1xuICAgICAgICAgICAgICAgICAgICAvLyBzdG9wIHN1YnNlcXVlbnQgZXJyb3JzIGhpdHRpbmcgY2FsbGJhY2sgbXVsdGlwbGUgdGltZXNcbiAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2sgPSBmdW5jdGlvbiAoKSB7fTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHJlc3VsdHNba10gPSBhcmdzO1xuICAgICAgICAgICAgICAgICAgICBhc3luYy5zZXRJbW1lZGlhdGUodGFza0NvbXBsZXRlKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgdmFyIHJlcXVpcmVzID0gdGFzay5zbGljZSgwLCBNYXRoLmFicyh0YXNrLmxlbmd0aCAtIDEpKSB8fCBbXTtcbiAgICAgICAgICAgIHZhciByZWFkeSA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gX3JlZHVjZShyZXF1aXJlcywgZnVuY3Rpb24gKGEsIHgpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIChhICYmIHJlc3VsdHMuaGFzT3duUHJvcGVydHkoeCkpO1xuICAgICAgICAgICAgICAgIH0sIHRydWUpICYmICFyZXN1bHRzLmhhc093blByb3BlcnR5KGspO1xuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIGlmIChyZWFkeSgpKSB7XG4gICAgICAgICAgICAgICAgdGFza1t0YXNrLmxlbmd0aCAtIDFdKHRhc2tDYWxsYmFjaywgcmVzdWx0cyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICB2YXIgbGlzdGVuZXIgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChyZWFkeSgpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZW1vdmVMaXN0ZW5lcihsaXN0ZW5lcik7XG4gICAgICAgICAgICAgICAgICAgICAgICB0YXNrW3Rhc2subGVuZ3RoIC0gMV0odGFza0NhbGxiYWNrLCByZXN1bHRzKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgYWRkTGlzdGVuZXIobGlzdGVuZXIpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICB9O1xuXG4gICAgYXN5bmMucmV0cnkgPSBmdW5jdGlvbih0aW1lcywgdGFzaywgY2FsbGJhY2spIHtcbiAgICAgICAgdmFyIERFRkFVTFRfVElNRVMgPSA1O1xuICAgICAgICB2YXIgYXR0ZW1wdHMgPSBbXTtcbiAgICAgICAgLy8gVXNlIGRlZmF1bHRzIGlmIHRpbWVzIG5vdCBwYXNzZWRcbiAgICAgICAgaWYgKHR5cGVvZiB0aW1lcyA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgICAgY2FsbGJhY2sgPSB0YXNrO1xuICAgICAgICAgICAgdGFzayA9IHRpbWVzO1xuICAgICAgICAgICAgdGltZXMgPSBERUZBVUxUX1RJTUVTO1xuICAgICAgICB9XG4gICAgICAgIC8vIE1ha2Ugc3VyZSB0aW1lcyBpcyBhIG51bWJlclxuICAgICAgICB0aW1lcyA9IHBhcnNlSW50KHRpbWVzLCAxMCkgfHwgREVGQVVMVF9USU1FUztcbiAgICAgICAgdmFyIHdyYXBwZWRUYXNrID0gZnVuY3Rpb24od3JhcHBlZENhbGxiYWNrLCB3cmFwcGVkUmVzdWx0cykge1xuICAgICAgICAgICAgdmFyIHJldHJ5QXR0ZW1wdCA9IGZ1bmN0aW9uKHRhc2ssIGZpbmFsQXR0ZW1wdCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBmdW5jdGlvbihzZXJpZXNDYWxsYmFjaykge1xuICAgICAgICAgICAgICAgICAgICB0YXNrKGZ1bmN0aW9uKGVyciwgcmVzdWx0KXtcbiAgICAgICAgICAgICAgICAgICAgICAgIHNlcmllc0NhbGxiYWNrKCFlcnIgfHwgZmluYWxBdHRlbXB0LCB7ZXJyOiBlcnIsIHJlc3VsdDogcmVzdWx0fSk7XG4gICAgICAgICAgICAgICAgICAgIH0sIHdyYXBwZWRSZXN1bHRzKTtcbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIHdoaWxlICh0aW1lcykge1xuICAgICAgICAgICAgICAgIGF0dGVtcHRzLnB1c2gocmV0cnlBdHRlbXB0KHRhc2ssICEodGltZXMtPTEpKSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBhc3luYy5zZXJpZXMoYXR0ZW1wdHMsIGZ1bmN0aW9uKGRvbmUsIGRhdGEpe1xuICAgICAgICAgICAgICAgIGRhdGEgPSBkYXRhW2RhdGEubGVuZ3RoIC0gMV07XG4gICAgICAgICAgICAgICAgKHdyYXBwZWRDYWxsYmFjayB8fCBjYWxsYmFjaykoZGF0YS5lcnIsIGRhdGEucmVzdWx0KTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICAgIC8vIElmIGEgY2FsbGJhY2sgaXMgcGFzc2VkLCBydW4gdGhpcyBhcyBhIGNvbnRyb2xsIGZsb3dcbiAgICAgICAgcmV0dXJuIGNhbGxiYWNrID8gd3JhcHBlZFRhc2soKSA6IHdyYXBwZWRUYXNrXG4gICAgfTtcblxuICAgIGFzeW5jLndhdGVyZmFsbCA9IGZ1bmN0aW9uICh0YXNrcywgY2FsbGJhY2spIHtcbiAgICAgICAgY2FsbGJhY2sgPSBjYWxsYmFjayB8fCBmdW5jdGlvbiAoKSB7fTtcbiAgICAgICAgaWYgKCFfaXNBcnJheSh0YXNrcykpIHtcbiAgICAgICAgICB2YXIgZXJyID0gbmV3IEVycm9yKCdGaXJzdCBhcmd1bWVudCB0byB3YXRlcmZhbGwgbXVzdCBiZSBhbiBhcnJheSBvZiBmdW5jdGlvbnMnKTtcbiAgICAgICAgICByZXR1cm4gY2FsbGJhY2soZXJyKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoIXRhc2tzLmxlbmd0aCkge1xuICAgICAgICAgICAgcmV0dXJuIGNhbGxiYWNrKCk7XG4gICAgICAgIH1cbiAgICAgICAgdmFyIHdyYXBJdGVyYXRvciA9IGZ1bmN0aW9uIChpdGVyYXRvcikge1xuICAgICAgICAgICAgcmV0dXJuIGZ1bmN0aW9uIChlcnIpIHtcbiAgICAgICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrLmFwcGx5KG51bGwsIGFyZ3VtZW50cyk7XG4gICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrID0gZnVuY3Rpb24gKCkge307XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICB2YXIgYXJncyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMSk7XG4gICAgICAgICAgICAgICAgICAgIHZhciBuZXh0ID0gaXRlcmF0b3IubmV4dCgpO1xuICAgICAgICAgICAgICAgICAgICBpZiAobmV4dCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgYXJncy5wdXNoKHdyYXBJdGVyYXRvcihuZXh0KSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBhcmdzLnB1c2goY2FsbGJhY2spO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGFzeW5jLnNldEltbWVkaWF0ZShmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpdGVyYXRvci5hcHBseShudWxsLCBhcmdzKTtcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfTtcbiAgICAgICAgfTtcbiAgICAgICAgd3JhcEl0ZXJhdG9yKGFzeW5jLml0ZXJhdG9yKHRhc2tzKSkoKTtcbiAgICB9O1xuXG4gICAgdmFyIF9wYXJhbGxlbCA9IGZ1bmN0aW9uKGVhY2hmbiwgdGFza3MsIGNhbGxiYWNrKSB7XG4gICAgICAgIGNhbGxiYWNrID0gY2FsbGJhY2sgfHwgZnVuY3Rpb24gKCkge307XG4gICAgICAgIGlmIChfaXNBcnJheSh0YXNrcykpIHtcbiAgICAgICAgICAgIGVhY2hmbi5tYXAodGFza3MsIGZ1bmN0aW9uIChmbiwgY2FsbGJhY2spIHtcbiAgICAgICAgICAgICAgICBpZiAoZm4pIHtcbiAgICAgICAgICAgICAgICAgICAgZm4oZnVuY3Rpb24gKGVycikge1xuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIGFyZ3MgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGFyZ3MubGVuZ3RoIDw9IDEpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBhcmdzID0gYXJnc1swXTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrLmNhbGwobnVsbCwgZXJyLCBhcmdzKTtcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSwgY2FsbGJhY2spO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgdmFyIHJlc3VsdHMgPSB7fTtcbiAgICAgICAgICAgIGVhY2hmbi5lYWNoKF9rZXlzKHRhc2tzKSwgZnVuY3Rpb24gKGssIGNhbGxiYWNrKSB7XG4gICAgICAgICAgICAgICAgdGFza3Nba10oZnVuY3Rpb24gKGVycikge1xuICAgICAgICAgICAgICAgICAgICB2YXIgYXJncyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMSk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChhcmdzLmxlbmd0aCA8PSAxKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBhcmdzID0gYXJnc1swXTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICByZXN1bHRzW2tdID0gYXJncztcbiAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2soZXJyKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0sIGZ1bmN0aW9uIChlcnIpIHtcbiAgICAgICAgICAgICAgICBjYWxsYmFjayhlcnIsIHJlc3VsdHMpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgYXN5bmMucGFyYWxsZWwgPSBmdW5jdGlvbiAodGFza3MsIGNhbGxiYWNrKSB7XG4gICAgICAgIF9wYXJhbGxlbCh7IG1hcDogYXN5bmMubWFwLCBlYWNoOiBhc3luYy5lYWNoIH0sIHRhc2tzLCBjYWxsYmFjayk7XG4gICAgfTtcblxuICAgIGFzeW5jLnBhcmFsbGVsTGltaXQgPSBmdW5jdGlvbih0YXNrcywgbGltaXQsIGNhbGxiYWNrKSB7XG4gICAgICAgIF9wYXJhbGxlbCh7IG1hcDogX21hcExpbWl0KGxpbWl0KSwgZWFjaDogX2VhY2hMaW1pdChsaW1pdCkgfSwgdGFza3MsIGNhbGxiYWNrKTtcbiAgICB9O1xuXG4gICAgYXN5bmMuc2VyaWVzID0gZnVuY3Rpb24gKHRhc2tzLCBjYWxsYmFjaykge1xuICAgICAgICBjYWxsYmFjayA9IGNhbGxiYWNrIHx8IGZ1bmN0aW9uICgpIHt9O1xuICAgICAgICBpZiAoX2lzQXJyYXkodGFza3MpKSB7XG4gICAgICAgICAgICBhc3luYy5tYXBTZXJpZXModGFza3MsIGZ1bmN0aW9uIChmbiwgY2FsbGJhY2spIHtcbiAgICAgICAgICAgICAgICBpZiAoZm4pIHtcbiAgICAgICAgICAgICAgICAgICAgZm4oZnVuY3Rpb24gKGVycikge1xuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIGFyZ3MgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGFyZ3MubGVuZ3RoIDw9IDEpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBhcmdzID0gYXJnc1swXTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrLmNhbGwobnVsbCwgZXJyLCBhcmdzKTtcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSwgY2FsbGJhY2spO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgdmFyIHJlc3VsdHMgPSB7fTtcbiAgICAgICAgICAgIGFzeW5jLmVhY2hTZXJpZXMoX2tleXModGFza3MpLCBmdW5jdGlvbiAoaywgY2FsbGJhY2spIHtcbiAgICAgICAgICAgICAgICB0YXNrc1trXShmdW5jdGlvbiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBhcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGFyZ3MubGVuZ3RoIDw9IDEpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGFyZ3MgPSBhcmdzWzBdO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIHJlc3VsdHNba10gPSBhcmdzO1xuICAgICAgICAgICAgICAgICAgICBjYWxsYmFjayhlcnIpO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSwgZnVuY3Rpb24gKGVycikge1xuICAgICAgICAgICAgICAgIGNhbGxiYWNrKGVyciwgcmVzdWx0cyk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICBhc3luYy5pdGVyYXRvciA9IGZ1bmN0aW9uICh0YXNrcykge1xuICAgICAgICB2YXIgbWFrZUNhbGxiYWNrID0gZnVuY3Rpb24gKGluZGV4KSB7XG4gICAgICAgICAgICB2YXIgZm4gPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgaWYgKHRhc2tzLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgICAgICB0YXNrc1tpbmRleF0uYXBwbHkobnVsbCwgYXJndW1lbnRzKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgcmV0dXJuIGZuLm5leHQoKTtcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICBmbi5uZXh0ID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIHJldHVybiAoaW5kZXggPCB0YXNrcy5sZW5ndGggLSAxKSA/IG1ha2VDYWxsYmFjayhpbmRleCArIDEpOiBudWxsO1xuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIHJldHVybiBmbjtcbiAgICAgICAgfTtcbiAgICAgICAgcmV0dXJuIG1ha2VDYWxsYmFjaygwKTtcbiAgICB9O1xuXG4gICAgYXN5bmMuYXBwbHkgPSBmdW5jdGlvbiAoZm4pIHtcbiAgICAgICAgdmFyIGFyZ3MgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpO1xuICAgICAgICByZXR1cm4gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgcmV0dXJuIGZuLmFwcGx5KFxuICAgICAgICAgICAgICAgIG51bGwsIGFyZ3MuY29uY2F0KEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cykpXG4gICAgICAgICAgICApO1xuICAgICAgICB9O1xuICAgIH07XG5cbiAgICB2YXIgX2NvbmNhdCA9IGZ1bmN0aW9uIChlYWNoZm4sIGFyciwgZm4sIGNhbGxiYWNrKSB7XG4gICAgICAgIHZhciByID0gW107XG4gICAgICAgIGVhY2hmbihhcnIsIGZ1bmN0aW9uICh4LCBjYikge1xuICAgICAgICAgICAgZm4oeCwgZnVuY3Rpb24gKGVyciwgeSkge1xuICAgICAgICAgICAgICAgIHIgPSByLmNvbmNhdCh5IHx8IFtdKTtcbiAgICAgICAgICAgICAgICBjYihlcnIpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0sIGZ1bmN0aW9uIChlcnIpIHtcbiAgICAgICAgICAgIGNhbGxiYWNrKGVyciwgcik7XG4gICAgICAgIH0pO1xuICAgIH07XG4gICAgYXN5bmMuY29uY2F0ID0gZG9QYXJhbGxlbChfY29uY2F0KTtcbiAgICBhc3luYy5jb25jYXRTZXJpZXMgPSBkb1NlcmllcyhfY29uY2F0KTtcblxuICAgIGFzeW5jLndoaWxzdCA9IGZ1bmN0aW9uICh0ZXN0LCBpdGVyYXRvciwgY2FsbGJhY2spIHtcbiAgICAgICAgaWYgKHRlc3QoKSkge1xuICAgICAgICAgICAgaXRlcmF0b3IoZnVuY3Rpb24gKGVycikge1xuICAgICAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGNhbGxiYWNrKGVycik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGFzeW5jLndoaWxzdCh0ZXN0LCBpdGVyYXRvciwgY2FsbGJhY2spO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICBjYWxsYmFjaygpO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIGFzeW5jLmRvV2hpbHN0ID0gZnVuY3Rpb24gKGl0ZXJhdG9yLCB0ZXN0LCBjYWxsYmFjaykge1xuICAgICAgICBpdGVyYXRvcihmdW5jdGlvbiAoZXJyKSB7XG4gICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGNhbGxiYWNrKGVycik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB2YXIgYXJncyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMSk7XG4gICAgICAgICAgICBpZiAodGVzdC5hcHBseShudWxsLCBhcmdzKSkge1xuICAgICAgICAgICAgICAgIGFzeW5jLmRvV2hpbHN0KGl0ZXJhdG9yLCB0ZXN0LCBjYWxsYmFjayk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICBjYWxsYmFjaygpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICB9O1xuXG4gICAgYXN5bmMudW50aWwgPSBmdW5jdGlvbiAodGVzdCwgaXRlcmF0b3IsIGNhbGxiYWNrKSB7XG4gICAgICAgIGlmICghdGVzdCgpKSB7XG4gICAgICAgICAgICBpdGVyYXRvcihmdW5jdGlvbiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gY2FsbGJhY2soZXJyKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgYXN5bmMudW50aWwodGVzdCwgaXRlcmF0b3IsIGNhbGxiYWNrKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgY2FsbGJhY2soKTtcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICBhc3luYy5kb1VudGlsID0gZnVuY3Rpb24gKGl0ZXJhdG9yLCB0ZXN0LCBjYWxsYmFjaykge1xuICAgICAgICBpdGVyYXRvcihmdW5jdGlvbiAoZXJyKSB7XG4gICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGNhbGxiYWNrKGVycik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB2YXIgYXJncyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMSk7XG4gICAgICAgICAgICBpZiAoIXRlc3QuYXBwbHkobnVsbCwgYXJncykpIHtcbiAgICAgICAgICAgICAgICBhc3luYy5kb1VudGlsKGl0ZXJhdG9yLCB0ZXN0LCBjYWxsYmFjayk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICBjYWxsYmFjaygpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICB9O1xuXG4gICAgYXN5bmMucXVldWUgPSBmdW5jdGlvbiAod29ya2VyLCBjb25jdXJyZW5jeSkge1xuICAgICAgICBpZiAoY29uY3VycmVuY3kgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgY29uY3VycmVuY3kgPSAxO1xuICAgICAgICB9XG4gICAgICAgIGZ1bmN0aW9uIF9pbnNlcnQocSwgZGF0YSwgcG9zLCBjYWxsYmFjaykge1xuICAgICAgICAgIGlmICghcS5zdGFydGVkKXtcbiAgICAgICAgICAgIHEuc3RhcnRlZCA9IHRydWU7XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmICghX2lzQXJyYXkoZGF0YSkpIHtcbiAgICAgICAgICAgICAgZGF0YSA9IFtkYXRhXTtcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYoZGF0YS5sZW5ndGggPT0gMCkge1xuICAgICAgICAgICAgIC8vIGNhbGwgZHJhaW4gaW1tZWRpYXRlbHkgaWYgdGhlcmUgYXJlIG5vIHRhc2tzXG4gICAgICAgICAgICAgcmV0dXJuIGFzeW5jLnNldEltbWVkaWF0ZShmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICAgaWYgKHEuZHJhaW4pIHtcbiAgICAgICAgICAgICAgICAgICAgIHEuZHJhaW4oKTtcbiAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH1cbiAgICAgICAgICBfZWFjaChkYXRhLCBmdW5jdGlvbih0YXNrKSB7XG4gICAgICAgICAgICAgIHZhciBpdGVtID0ge1xuICAgICAgICAgICAgICAgICAgZGF0YTogdGFzayxcbiAgICAgICAgICAgICAgICAgIGNhbGxiYWNrOiB0eXBlb2YgY2FsbGJhY2sgPT09ICdmdW5jdGlvbicgPyBjYWxsYmFjayA6IG51bGxcbiAgICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgICBpZiAocG9zKSB7XG4gICAgICAgICAgICAgICAgcS50YXNrcy51bnNoaWZ0KGl0ZW0pO1xuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHEudGFza3MucHVzaChpdGVtKTtcbiAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgIGlmIChxLnNhdHVyYXRlZCAmJiBxLnRhc2tzLmxlbmd0aCA9PT0gcS5jb25jdXJyZW5jeSkge1xuICAgICAgICAgICAgICAgICAgcS5zYXR1cmF0ZWQoKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBhc3luYy5zZXRJbW1lZGlhdGUocS5wcm9jZXNzKTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIHZhciB3b3JrZXJzID0gMDtcbiAgICAgICAgdmFyIHEgPSB7XG4gICAgICAgICAgICB0YXNrczogW10sXG4gICAgICAgICAgICBjb25jdXJyZW5jeTogY29uY3VycmVuY3ksXG4gICAgICAgICAgICBzYXR1cmF0ZWQ6IG51bGwsXG4gICAgICAgICAgICBlbXB0eTogbnVsbCxcbiAgICAgICAgICAgIGRyYWluOiBudWxsLFxuICAgICAgICAgICAgc3RhcnRlZDogZmFsc2UsXG4gICAgICAgICAgICBwYXVzZWQ6IGZhbHNlLFxuICAgICAgICAgICAgcHVzaDogZnVuY3Rpb24gKGRhdGEsIGNhbGxiYWNrKSB7XG4gICAgICAgICAgICAgIF9pbnNlcnQocSwgZGF0YSwgZmFsc2UsIGNhbGxiYWNrKTtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBraWxsOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgIHEuZHJhaW4gPSBudWxsO1xuICAgICAgICAgICAgICBxLnRhc2tzID0gW107XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgdW5zaGlmdDogZnVuY3Rpb24gKGRhdGEsIGNhbGxiYWNrKSB7XG4gICAgICAgICAgICAgIF9pbnNlcnQocSwgZGF0YSwgdHJ1ZSwgY2FsbGJhY2spO1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHByb2Nlc3M6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICBpZiAoIXEucGF1c2VkICYmIHdvcmtlcnMgPCBxLmNvbmN1cnJlbmN5ICYmIHEudGFza3MubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciB0YXNrID0gcS50YXNrcy5zaGlmdCgpO1xuICAgICAgICAgICAgICAgICAgICBpZiAocS5lbXB0eSAmJiBxLnRhc2tzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcS5lbXB0eSgpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIHdvcmtlcnMgKz0gMTtcbiAgICAgICAgICAgICAgICAgICAgdmFyIG5leHQgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB3b3JrZXJzIC09IDE7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAodGFzay5jYWxsYmFjaykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRhc2suY2FsbGJhY2suYXBwbHkodGFzaywgYXJndW1lbnRzKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChxLmRyYWluICYmIHEudGFza3MubGVuZ3RoICsgd29ya2VycyA9PT0gMCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHEuZHJhaW4oKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIHEucHJvY2VzcygpO1xuICAgICAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgICAgICB2YXIgY2IgPSBvbmx5X29uY2UobmV4dCk7XG4gICAgICAgICAgICAgICAgICAgIHdvcmtlcih0YXNrLmRhdGEsIGNiKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgbGVuZ3RoOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHEudGFza3MubGVuZ3RoO1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHJ1bm5pbmc6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gd29ya2VycztcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBpZGxlOiBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gcS50YXNrcy5sZW5ndGggKyB3b3JrZXJzID09PSAwO1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHBhdXNlOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgaWYgKHEucGF1c2VkID09PSB0cnVlKSB7IHJldHVybjsgfVxuICAgICAgICAgICAgICAgIHEucGF1c2VkID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICBxLnByb2Nlc3MoKTtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICByZXN1bWU6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICBpZiAocS5wYXVzZWQgPT09IGZhbHNlKSB7IHJldHVybjsgfVxuICAgICAgICAgICAgICAgIHEucGF1c2VkID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgcS5wcm9jZXNzKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgICAgIHJldHVybiBxO1xuICAgIH07XG4gICAgXG4gICAgYXN5bmMucHJpb3JpdHlRdWV1ZSA9IGZ1bmN0aW9uICh3b3JrZXIsIGNvbmN1cnJlbmN5KSB7XG4gICAgICAgIFxuICAgICAgICBmdW5jdGlvbiBfY29tcGFyZVRhc2tzKGEsIGIpe1xuICAgICAgICAgIHJldHVybiBhLnByaW9yaXR5IC0gYi5wcmlvcml0eTtcbiAgICAgICAgfTtcbiAgICAgICAgXG4gICAgICAgIGZ1bmN0aW9uIF9iaW5hcnlTZWFyY2goc2VxdWVuY2UsIGl0ZW0sIGNvbXBhcmUpIHtcbiAgICAgICAgICB2YXIgYmVnID0gLTEsXG4gICAgICAgICAgICAgIGVuZCA9IHNlcXVlbmNlLmxlbmd0aCAtIDE7XG4gICAgICAgICAgd2hpbGUgKGJlZyA8IGVuZCkge1xuICAgICAgICAgICAgdmFyIG1pZCA9IGJlZyArICgoZW5kIC0gYmVnICsgMSkgPj4+IDEpO1xuICAgICAgICAgICAgaWYgKGNvbXBhcmUoaXRlbSwgc2VxdWVuY2VbbWlkXSkgPj0gMCkge1xuICAgICAgICAgICAgICBiZWcgPSBtaWQ7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBlbmQgPSBtaWQgLSAxO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICByZXR1cm4gYmVnO1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICBmdW5jdGlvbiBfaW5zZXJ0KHEsIGRhdGEsIHByaW9yaXR5LCBjYWxsYmFjaykge1xuICAgICAgICAgIGlmICghcS5zdGFydGVkKXtcbiAgICAgICAgICAgIHEuc3RhcnRlZCA9IHRydWU7XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmICghX2lzQXJyYXkoZGF0YSkpIHtcbiAgICAgICAgICAgICAgZGF0YSA9IFtkYXRhXTtcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYoZGF0YS5sZW5ndGggPT0gMCkge1xuICAgICAgICAgICAgIC8vIGNhbGwgZHJhaW4gaW1tZWRpYXRlbHkgaWYgdGhlcmUgYXJlIG5vIHRhc2tzXG4gICAgICAgICAgICAgcmV0dXJuIGFzeW5jLnNldEltbWVkaWF0ZShmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICAgaWYgKHEuZHJhaW4pIHtcbiAgICAgICAgICAgICAgICAgICAgIHEuZHJhaW4oKTtcbiAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH1cbiAgICAgICAgICBfZWFjaChkYXRhLCBmdW5jdGlvbih0YXNrKSB7XG4gICAgICAgICAgICAgIHZhciBpdGVtID0ge1xuICAgICAgICAgICAgICAgICAgZGF0YTogdGFzayxcbiAgICAgICAgICAgICAgICAgIHByaW9yaXR5OiBwcmlvcml0eSxcbiAgICAgICAgICAgICAgICAgIGNhbGxiYWNrOiB0eXBlb2YgY2FsbGJhY2sgPT09ICdmdW5jdGlvbicgPyBjYWxsYmFjayA6IG51bGxcbiAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgIHEudGFza3Muc3BsaWNlKF9iaW5hcnlTZWFyY2gocS50YXNrcywgaXRlbSwgX2NvbXBhcmVUYXNrcykgKyAxLCAwLCBpdGVtKTtcblxuICAgICAgICAgICAgICBpZiAocS5zYXR1cmF0ZWQgJiYgcS50YXNrcy5sZW5ndGggPT09IHEuY29uY3VycmVuY3kpIHtcbiAgICAgICAgICAgICAgICAgIHEuc2F0dXJhdGVkKCk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgYXN5bmMuc2V0SW1tZWRpYXRlKHEucHJvY2Vzcyk7XG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIC8vIFN0YXJ0IHdpdGggYSBub3JtYWwgcXVldWVcbiAgICAgICAgdmFyIHEgPSBhc3luYy5xdWV1ZSh3b3JrZXIsIGNvbmN1cnJlbmN5KTtcbiAgICAgICAgXG4gICAgICAgIC8vIE92ZXJyaWRlIHB1c2ggdG8gYWNjZXB0IHNlY29uZCBwYXJhbWV0ZXIgcmVwcmVzZW50aW5nIHByaW9yaXR5XG4gICAgICAgIHEucHVzaCA9IGZ1bmN0aW9uIChkYXRhLCBwcmlvcml0eSwgY2FsbGJhY2spIHtcbiAgICAgICAgICBfaW5zZXJ0KHEsIGRhdGEsIHByaW9yaXR5LCBjYWxsYmFjayk7XG4gICAgICAgIH07XG4gICAgICAgIFxuICAgICAgICAvLyBSZW1vdmUgdW5zaGlmdCBmdW5jdGlvblxuICAgICAgICBkZWxldGUgcS51bnNoaWZ0O1xuXG4gICAgICAgIHJldHVybiBxO1xuICAgIH07XG5cbiAgICBhc3luYy5jYXJnbyA9IGZ1bmN0aW9uICh3b3JrZXIsIHBheWxvYWQpIHtcbiAgICAgICAgdmFyIHdvcmtpbmcgICAgID0gZmFsc2UsXG4gICAgICAgICAgICB0YXNrcyAgICAgICA9IFtdO1xuXG4gICAgICAgIHZhciBjYXJnbyA9IHtcbiAgICAgICAgICAgIHRhc2tzOiB0YXNrcyxcbiAgICAgICAgICAgIHBheWxvYWQ6IHBheWxvYWQsXG4gICAgICAgICAgICBzYXR1cmF0ZWQ6IG51bGwsXG4gICAgICAgICAgICBlbXB0eTogbnVsbCxcbiAgICAgICAgICAgIGRyYWluOiBudWxsLFxuICAgICAgICAgICAgZHJhaW5lZDogdHJ1ZSxcbiAgICAgICAgICAgIHB1c2g6IGZ1bmN0aW9uIChkYXRhLCBjYWxsYmFjaykge1xuICAgICAgICAgICAgICAgIGlmICghX2lzQXJyYXkoZGF0YSkpIHtcbiAgICAgICAgICAgICAgICAgICAgZGF0YSA9IFtkYXRhXTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgX2VhY2goZGF0YSwgZnVuY3Rpb24odGFzaykge1xuICAgICAgICAgICAgICAgICAgICB0YXNrcy5wdXNoKHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGRhdGE6IHRhc2ssXG4gICAgICAgICAgICAgICAgICAgICAgICBjYWxsYmFjazogdHlwZW9mIGNhbGxiYWNrID09PSAnZnVuY3Rpb24nID8gY2FsbGJhY2sgOiBudWxsXG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICBjYXJnby5kcmFpbmVkID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgIGlmIChjYXJnby5zYXR1cmF0ZWQgJiYgdGFza3MubGVuZ3RoID09PSBwYXlsb2FkKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjYXJnby5zYXR1cmF0ZWQoKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIGFzeW5jLnNldEltbWVkaWF0ZShjYXJnby5wcm9jZXNzKTtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBwcm9jZXNzOiBmdW5jdGlvbiBwcm9jZXNzKCkge1xuICAgICAgICAgICAgICAgIGlmICh3b3JraW5nKSByZXR1cm47XG4gICAgICAgICAgICAgICAgaWYgKHRhc2tzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgICAgICAgICAgICBpZihjYXJnby5kcmFpbiAmJiAhY2FyZ28uZHJhaW5lZCkgY2FyZ28uZHJhaW4oKTtcbiAgICAgICAgICAgICAgICAgICAgY2FyZ28uZHJhaW5lZCA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICB2YXIgdHMgPSB0eXBlb2YgcGF5bG9hZCA9PT0gJ251bWJlcidcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA/IHRhc2tzLnNwbGljZSgwLCBwYXlsb2FkKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDogdGFza3Muc3BsaWNlKDAsIHRhc2tzLmxlbmd0aCk7XG5cbiAgICAgICAgICAgICAgICB2YXIgZHMgPSBfbWFwKHRzLCBmdW5jdGlvbiAodGFzaykge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gdGFzay5kYXRhO1xuICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAgICAgaWYoY2FyZ28uZW1wdHkpIGNhcmdvLmVtcHR5KCk7XG4gICAgICAgICAgICAgICAgd29ya2luZyA9IHRydWU7XG4gICAgICAgICAgICAgICAgd29ya2VyKGRzLCBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgICAgIHdvcmtpbmcgPSBmYWxzZTtcblxuICAgICAgICAgICAgICAgICAgICB2YXIgYXJncyA9IGFyZ3VtZW50cztcbiAgICAgICAgICAgICAgICAgICAgX2VhY2godHMsIGZ1bmN0aW9uIChkYXRhKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoZGF0YS5jYWxsYmFjaykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRhdGEuY2FsbGJhY2suYXBwbHkobnVsbCwgYXJncyk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAgICAgICAgIHByb2Nlc3MoKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBsZW5ndGg6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdGFza3MubGVuZ3RoO1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHJ1bm5pbmc6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gd29ya2luZztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICAgICAgcmV0dXJuIGNhcmdvO1xuICAgIH07XG5cbiAgICB2YXIgX2NvbnNvbGVfZm4gPSBmdW5jdGlvbiAobmFtZSkge1xuICAgICAgICByZXR1cm4gZnVuY3Rpb24gKGZuKSB7XG4gICAgICAgICAgICB2YXIgYXJncyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMSk7XG4gICAgICAgICAgICBmbi5hcHBseShudWxsLCBhcmdzLmNvbmNhdChbZnVuY3Rpb24gKGVycikge1xuICAgICAgICAgICAgICAgIHZhciBhcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKTtcbiAgICAgICAgICAgICAgICBpZiAodHlwZW9mIGNvbnNvbGUgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChjb25zb2xlLmVycm9yKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcihlcnIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGVsc2UgaWYgKGNvbnNvbGVbbmFtZV0pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIF9lYWNoKGFyZ3MsIGZ1bmN0aW9uICh4KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZVtuYW1lXSh4KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfV0pKTtcbiAgICAgICAgfTtcbiAgICB9O1xuICAgIGFzeW5jLmxvZyA9IF9jb25zb2xlX2ZuKCdsb2cnKTtcbiAgICBhc3luYy5kaXIgPSBfY29uc29sZV9mbignZGlyJyk7XG4gICAgLyphc3luYy5pbmZvID0gX2NvbnNvbGVfZm4oJ2luZm8nKTtcbiAgICBhc3luYy53YXJuID0gX2NvbnNvbGVfZm4oJ3dhcm4nKTtcbiAgICBhc3luYy5lcnJvciA9IF9jb25zb2xlX2ZuKCdlcnJvcicpOyovXG5cbiAgICBhc3luYy5tZW1vaXplID0gZnVuY3Rpb24gKGZuLCBoYXNoZXIpIHtcbiAgICAgICAgdmFyIG1lbW8gPSB7fTtcbiAgICAgICAgdmFyIHF1ZXVlcyA9IHt9O1xuICAgICAgICBoYXNoZXIgPSBoYXNoZXIgfHwgZnVuY3Rpb24gKHgpIHtcbiAgICAgICAgICAgIHJldHVybiB4O1xuICAgICAgICB9O1xuICAgICAgICB2YXIgbWVtb2l6ZWQgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICB2YXIgYXJncyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cyk7XG4gICAgICAgICAgICB2YXIgY2FsbGJhY2sgPSBhcmdzLnBvcCgpO1xuICAgICAgICAgICAgdmFyIGtleSA9IGhhc2hlci5hcHBseShudWxsLCBhcmdzKTtcbiAgICAgICAgICAgIGlmIChrZXkgaW4gbWVtbykge1xuICAgICAgICAgICAgICAgIGFzeW5jLm5leHRUaWNrKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2suYXBwbHkobnVsbCwgbWVtb1trZXldKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2UgaWYgKGtleSBpbiBxdWV1ZXMpIHtcbiAgICAgICAgICAgICAgICBxdWV1ZXNba2V5XS5wdXNoKGNhbGxiYWNrKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIHF1ZXVlc1trZXldID0gW2NhbGxiYWNrXTtcbiAgICAgICAgICAgICAgICBmbi5hcHBseShudWxsLCBhcmdzLmNvbmNhdChbZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgICAgICBtZW1vW2tleV0gPSBhcmd1bWVudHM7XG4gICAgICAgICAgICAgICAgICAgIHZhciBxID0gcXVldWVzW2tleV07XG4gICAgICAgICAgICAgICAgICAgIGRlbGV0ZSBxdWV1ZXNba2V5XTtcbiAgICAgICAgICAgICAgICAgICAgZm9yICh2YXIgaSA9IDAsIGwgPSBxLmxlbmd0aDsgaSA8IGw7IGkrKykge1xuICAgICAgICAgICAgICAgICAgICAgIHFbaV0uYXBwbHkobnVsbCwgYXJndW1lbnRzKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1dKSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgICAgIG1lbW9pemVkLm1lbW8gPSBtZW1vO1xuICAgICAgICBtZW1vaXplZC51bm1lbW9pemVkID0gZm47XG4gICAgICAgIHJldHVybiBtZW1vaXplZDtcbiAgICB9O1xuXG4gICAgYXN5bmMudW5tZW1vaXplID0gZnVuY3Rpb24gKGZuKSB7XG4gICAgICByZXR1cm4gZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gKGZuLnVubWVtb2l6ZWQgfHwgZm4pLmFwcGx5KG51bGwsIGFyZ3VtZW50cyk7XG4gICAgICB9O1xuICAgIH07XG5cbiAgICBhc3luYy50aW1lcyA9IGZ1bmN0aW9uIChjb3VudCwgaXRlcmF0b3IsIGNhbGxiYWNrKSB7XG4gICAgICAgIHZhciBjb3VudGVyID0gW107XG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgY291bnQ7IGkrKykge1xuICAgICAgICAgICAgY291bnRlci5wdXNoKGkpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBhc3luYy5tYXAoY291bnRlciwgaXRlcmF0b3IsIGNhbGxiYWNrKTtcbiAgICB9O1xuXG4gICAgYXN5bmMudGltZXNTZXJpZXMgPSBmdW5jdGlvbiAoY291bnQsIGl0ZXJhdG9yLCBjYWxsYmFjaykge1xuICAgICAgICB2YXIgY291bnRlciA9IFtdO1xuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGNvdW50OyBpKyspIHtcbiAgICAgICAgICAgIGNvdW50ZXIucHVzaChpKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gYXN5bmMubWFwU2VyaWVzKGNvdW50ZXIsIGl0ZXJhdG9yLCBjYWxsYmFjayk7XG4gICAgfTtcblxuICAgIGFzeW5jLnNlcSA9IGZ1bmN0aW9uICgvKiBmdW5jdGlvbnMuLi4gKi8pIHtcbiAgICAgICAgdmFyIGZucyA9IGFyZ3VtZW50cztcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHZhciB0aGF0ID0gdGhpcztcbiAgICAgICAgICAgIHZhciBhcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzKTtcbiAgICAgICAgICAgIHZhciBjYWxsYmFjayA9IGFyZ3MucG9wKCk7XG4gICAgICAgICAgICBhc3luYy5yZWR1Y2UoZm5zLCBhcmdzLCBmdW5jdGlvbiAobmV3YXJncywgZm4sIGNiKSB7XG4gICAgICAgICAgICAgICAgZm4uYXBwbHkodGhhdCwgbmV3YXJncy5jb25jYXQoW2Z1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIGVyciA9IGFyZ3VtZW50c1swXTtcbiAgICAgICAgICAgICAgICAgICAgdmFyIG5leHRhcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKTtcbiAgICAgICAgICAgICAgICAgICAgY2IoZXJyLCBuZXh0YXJncyk7XG4gICAgICAgICAgICAgICAgfV0pKVxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGZ1bmN0aW9uIChlcnIsIHJlc3VsdHMpIHtcbiAgICAgICAgICAgICAgICBjYWxsYmFjay5hcHBseSh0aGF0LCBbZXJyXS5jb25jYXQocmVzdWx0cykpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH07XG4gICAgfTtcblxuICAgIGFzeW5jLmNvbXBvc2UgPSBmdW5jdGlvbiAoLyogZnVuY3Rpb25zLi4uICovKSB7XG4gICAgICByZXR1cm4gYXN5bmMuc2VxLmFwcGx5KG51bGwsIEFycmF5LnByb3RvdHlwZS5yZXZlcnNlLmNhbGwoYXJndW1lbnRzKSk7XG4gICAgfTtcblxuICAgIHZhciBfYXBwbHlFYWNoID0gZnVuY3Rpb24gKGVhY2hmbiwgZm5zIC8qYXJncy4uLiovKSB7XG4gICAgICAgIHZhciBnbyA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHZhciB0aGF0ID0gdGhpcztcbiAgICAgICAgICAgIHZhciBhcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzKTtcbiAgICAgICAgICAgIHZhciBjYWxsYmFjayA9IGFyZ3MucG9wKCk7XG4gICAgICAgICAgICByZXR1cm4gZWFjaGZuKGZucywgZnVuY3Rpb24gKGZuLCBjYikge1xuICAgICAgICAgICAgICAgIGZuLmFwcGx5KHRoYXQsIGFyZ3MuY29uY2F0KFtjYl0pKTtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBjYWxsYmFjayk7XG4gICAgICAgIH07XG4gICAgICAgIGlmIChhcmd1bWVudHMubGVuZ3RoID4gMikge1xuICAgICAgICAgICAgdmFyIGFyZ3MgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMsIDIpO1xuICAgICAgICAgICAgcmV0dXJuIGdvLmFwcGx5KHRoaXMsIGFyZ3MpO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgcmV0dXJuIGdvO1xuICAgICAgICB9XG4gICAgfTtcbiAgICBhc3luYy5hcHBseUVhY2ggPSBkb1BhcmFsbGVsKF9hcHBseUVhY2gpO1xuICAgIGFzeW5jLmFwcGx5RWFjaFNlcmllcyA9IGRvU2VyaWVzKF9hcHBseUVhY2gpO1xuXG4gICAgYXN5bmMuZm9yZXZlciA9IGZ1bmN0aW9uIChmbiwgY2FsbGJhY2spIHtcbiAgICAgICAgZnVuY3Rpb24gbmV4dChlcnIpIHtcbiAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICBpZiAoY2FsbGJhY2spIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGNhbGxiYWNrKGVycik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHRocm93IGVycjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGZuKG5leHQpO1xuICAgICAgICB9XG4gICAgICAgIG5leHQoKTtcbiAgICB9O1xuXG4gICAgLy8gTm9kZS5qc1xuICAgIGlmICh0eXBlb2YgbW9kdWxlICE9PSAndW5kZWZpbmVkJyAmJiBtb2R1bGUuZXhwb3J0cykge1xuICAgICAgICBtb2R1bGUuZXhwb3J0cyA9IGFzeW5jO1xuICAgIH1cbiAgICAvLyBBTUQgLyBSZXF1aXJlSlNcbiAgICBlbHNlIGlmICh0eXBlb2YgZGVmaW5lICE9PSAndW5kZWZpbmVkJyAmJiBkZWZpbmUuYW1kKSB7XG4gICAgICAgIGRlZmluZShbXSwgZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgcmV0dXJuIGFzeW5jO1xuICAgICAgICB9KTtcbiAgICB9XG4gICAgLy8gaW5jbHVkZWQgZGlyZWN0bHkgdmlhIDxzY3JpcHQ+IHRhZ1xuICAgIGVsc2Uge1xuICAgICAgICByb290LmFzeW5jID0gYXN5bmM7XG4gICAgfVxuXG59KCkpO1xuXG59KS5jYWxsKHRoaXMscmVxdWlyZSgnX3Byb2Nlc3MnKSkiLCIoZnVuY3Rpb24gKEJ1ZmZlcil7XG5cInVzZSBzdHJpY3RcIjtcblxuZnVuY3Rpb24gU2VyaWFsUG9ydChwYXRoLCBvcHRpb25zLCBvcGVuSW1tZWRpYXRlbHkpIHtcblx0Y29uc29sZS5sb2coXCJTZXJpYWxQb3J0IGNvbnN0cnVjdGVkLlwiKTtcblxuXHR0aGlzLmNvbU5hbWUgPSBwYXRoO1xuXG5cdGlmIChvcHRpb25zKSB7XG5cdFx0Zm9yICh2YXIga2V5IGluIHRoaXMub3B0aW9ucykge1xuXHRcdFx0Ly9jb25zb2xlLmxvZyhcIkxvb2tpbmcgZm9yIFwiICsga2V5ICsgXCIgb3B0aW9uLlwiKTtcblx0XHRcdGlmIChvcHRpb25zW2tleV0gIT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRcdC8vY29uc29sZS5sb2coXCJSZXBsYWNpbmcgXCIgKyBrZXkgKyBcIiB3aXRoIFwiICsgb3B0aW9uc1trZXldKTtcblx0XHRcdFx0dGhpcy5vcHRpb25zW2tleV0gPSBvcHRpb25zW2tleV07XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0aWYgKHR5cGVvZiBjaHJvbWUgIT0gXCJ1bmRlZmluZWRcIiAmJiBjaHJvbWUuc2VyaWFsKSB7XG5cdFx0dmFyIHNlbGYgPSB0aGlzO1xuXG5cdFx0aWYgKG9wZW5JbW1lZGlhdGVseSAhPSBmYWxzZSkge1xuXHRcdFx0dGhpcy5vcGVuKCk7XG5cdFx0fVxuXG5cdH0gZWxzZSB7XG5cdFx0dGhyb3cgXCJObyBhY2Nlc3MgdG8gc2VyaWFsIHBvcnRzLiBUcnkgbG9hZGluZyBhcyBhIENocm9tZSBBcHBsaWNhdGlvbi5cIjtcblx0fVxufVxuXG5TZXJpYWxQb3J0LnByb3RvdHlwZS5vcHRpb25zID0ge1xuICAgIGJhdWRyYXRlOiA1NzYwMCxcbiAgICBidWZmZXJzaXplOiAxXG59O1xuXG5TZXJpYWxQb3J0LnByb3RvdHlwZS5jb25uZWN0aW9uSWQgPSAtMTtcblxuU2VyaWFsUG9ydC5wcm90b3R5cGUuY29tTmFtZSA9IFwiXCI7XG5cblNlcmlhbFBvcnQucHJvdG90eXBlLmV2ZW50TGlzdGVuZXJzID0ge307XG5cblNlcmlhbFBvcnQucHJvdG90eXBlLm9wZW4gPSBmdW5jdGlvbiAoY2FsbGJhY2spIHtcblx0Y29uc29sZS5sb2coXCJPcGVuaW5nIFwiLCB0aGlzLmNvbU5hbWUpO1xuXHRjaHJvbWUuc2VyaWFsLmNvbm5lY3QodGhpcy5jb21OYW1lLCB7Yml0cmF0ZTogcGFyc2VJbnQodGhpcy5vcHRpb25zLmJhdWRyYXRlKX0sIHRoaXMucHJveHkoJ29uT3BlbicsIGNhbGxiYWNrKSk7XG59O1xuXG5TZXJpYWxQb3J0LnByb3RvdHlwZS5vbk9wZW4gPSBmdW5jdGlvbiAoY2FsbGJhY2ssIG9wZW5JbmZvKSB7XG5cdGNvbnNvbGUubG9nKFwib25PcGVuXCIsIGNhbGxiYWNrLCBvcGVuSW5mbyk7XG5cdHRoaXMuY29ubmVjdGlvbklkID0gb3BlbkluZm8uY29ubmVjdGlvbklkO1xuXHRpZiAodGhpcy5jb25uZWN0aW9uSWQgPT0gLTEpIHtcblx0XHR0aGlzLnB1Ymxpc2hFdmVudChcImVycm9yXCIsIFwiQ291bGQgbm90IG9wZW4gcG9ydC5cIik7XG5cdFx0cmV0dXJuO1xuXHR9XG5cblx0dGhpcy5wdWJsaXNoRXZlbnQoXCJvcGVuXCIsIG9wZW5JbmZvKTtcblxuXG5cdGNvbnNvbGUubG9nKCdDb25uZWN0ZWQgdG8gcG9ydC4nLCB0aGlzLmNvbm5lY3Rpb25JZCk7XG5cblx0dHlwZW9mIGNhbGxiYWNrID09IFwiZnVuY3Rpb25cIiAmJiBjYWxsYmFjayhudWxsLCBvcGVuSW5mbyk7XG5cblx0Y2hyb21lLnNlcmlhbC5vblJlY2VpdmUuYWRkTGlzdGVuZXIodGhpcy5wcm94eSgnb25SZWFkJykpO1xuXG59O1xuXG5TZXJpYWxQb3J0LnByb3RvdHlwZS5vblJlYWQgPSBmdW5jdGlvbiAocmVhZEluZm8pIHtcblx0aWYgKHJlYWRJbmZvICYmIHRoaXMuY29ubmVjdGlvbklkID09IHJlYWRJbmZvLmNvbm5lY3Rpb25JZCkge1xuXG5cdFx0dmFyIHVpbnQ4VmlldyA9IG5ldyBVaW50OEFycmF5KHJlYWRJbmZvLmRhdGEpO1xuXHRcdHZhciBzdHJpbmcgPSBcIlwiO1xuXHRcdGZvciAodmFyIGkgPSAwOyBpIDwgcmVhZEluZm8uZGF0YS5ieXRlTGVuZ3RoOyBpKyspIHtcblx0XHRcdHN0cmluZyArPSBTdHJpbmcuZnJvbUNoYXJDb2RlKHVpbnQ4Vmlld1tpXSk7XG5cdFx0fVxuXG5cdFx0Ly9jb25zb2xlLmxvZyhcIkdvdCBkYXRhXCIsIHN0cmluZywgcmVhZEluZm8uZGF0YSk7XG5cblx0XHR0aGlzLnB1Ymxpc2hFdmVudChcImRhdGFcIiwgdG9CdWZmZXIodWludDhWaWV3KSk7XG5cdFx0dGhpcy5wdWJsaXNoRXZlbnQoXCJkYXRhU3RyaW5nXCIsIHN0cmluZyk7XG5cdH1cbn1cblxuU2VyaWFsUG9ydC5wcm90b3R5cGUud3JpdGUgPSBmdW5jdGlvbiAoYnVmZmVyLCBjYWxsYmFjaykge1xuXHRpZiAodHlwZW9mIGNhbGxiYWNrICE9IFwiZnVuY3Rpb25cIikgeyBjYWxsYmFjayA9IGZ1bmN0aW9uKCkge307IH1cblxuXHQvL01ha2Ugc3VyZSBpdHMgbm90IGEgYnJvd3NlcmlmeSBmYXV4IEJ1ZmZlci5cblx0aWYgKGJ1ZmZlciBpbnN0YW5jZW9mIEFycmF5QnVmZmVyID09IGZhbHNlKSB7XG5cdFx0YnVmZmVyID0gYnVmZmVyMkFycmF5QnVmZmVyKGJ1ZmZlcik7XG5cdH1cblxuXHRjaHJvbWUuc2VyaWFsLnNlbmQodGhpcy5jb25uZWN0aW9uSWQsIGJ1ZmZlciwgY2FsbGJhY2spO1xufTtcblxuU2VyaWFsUG9ydC5wcm90b3R5cGUud3JpdGVTdHJpbmcgPSBmdW5jdGlvbiAoc3RyaW5nLCBjYWxsYmFjaykge1xuXHR0aGlzLndyaXRlKHN0cjJhYihzdHJpbmcpLCBjYWxsYmFjayk7XG59O1xuXG5TZXJpYWxQb3J0LnByb3RvdHlwZS5jbG9zZSA9IGZ1bmN0aW9uIChjYWxsYmFjaykge1xuXHRjaHJvbWUuc2VyaWFsLmRpc2Nvbm5lY3QodGhpcy5jb25uZWN0aW9uSWQsIHRoaXMucHJveHkoJ29uQ2xvc2UnLCBjYWxsYmFjaykpO1xufTtcblxuU2VyaWFsUG9ydC5wcm90b3R5cGUub25DbG9zZSA9IGZ1bmN0aW9uIChjYWxsYmFjaykge1xuXHR0aGlzLmNvbm5lY3Rpb25JZCA9IC0xO1xuXHRjb25zb2xlLmxvZyhcIkNsb3NlZCBwb3J0XCIsIGFyZ3VtZW50cyk7XG5cdHRoaXMucHVibGlzaEV2ZW50KFwiY2xvc2VcIik7XG5cdHR5cGVvZiBjYWxsYmFjayA9PSBcImZ1bmN0aW9uXCIgJiYgY2FsbGJhY2sobnVsbCk7XG59O1xuXG5TZXJpYWxQb3J0LnByb3RvdHlwZS5mbHVzaCA9IGZ1bmN0aW9uIChjYWxsYmFjaykge1xuXG59O1xuXG4vL0V4cGVjdGluZzogZGF0YSwgZXJyb3JcblNlcmlhbFBvcnQucHJvdG90eXBlLm9uID0gZnVuY3Rpb24gKGV2ZW50TmFtZSwgY2FsbGJhY2spIHtcblx0aWYgKHRoaXMuZXZlbnRMaXN0ZW5lcnNbZXZlbnROYW1lXSA9PSB1bmRlZmluZWQpIHtcblx0XHR0aGlzLmV2ZW50TGlzdGVuZXJzW2V2ZW50TmFtZV0gPSBbXTtcblx0fVxuXHRpZiAodHlwZW9mIGNhbGxiYWNrID09IFwiZnVuY3Rpb25cIikge1xuXHRcdHRoaXMuZXZlbnRMaXN0ZW5lcnNbZXZlbnROYW1lXS5wdXNoKGNhbGxiYWNrKTtcblx0fSBlbHNlIHtcblx0XHR0aHJvdyBcImNhbiBub3Qgc3Vic2NyaWJlIHdpdGggYSBub24gZnVuY3Rpb24gY2FsbGJhY2tcIjtcblx0fVxufVxuXG5TZXJpYWxQb3J0LnByb3RvdHlwZS5wdWJsaXNoRXZlbnQgPSBmdW5jdGlvbiAoZXZlbnROYW1lLCBkYXRhKSB7XG5cdGlmICh0aGlzLmV2ZW50TGlzdGVuZXJzW2V2ZW50TmFtZV0gIT0gdW5kZWZpbmVkKSB7XG5cdFx0Zm9yICh2YXIgaSA9IDA7IGkgPCB0aGlzLmV2ZW50TGlzdGVuZXJzW2V2ZW50TmFtZV0ubGVuZ3RoOyBpKyspIHtcblx0XHRcdHRoaXMuZXZlbnRMaXN0ZW5lcnNbZXZlbnROYW1lXVtpXShkYXRhKTtcblx0XHR9XG5cdH1cbn1cblxuU2VyaWFsUG9ydC5wcm90b3R5cGUucHJveHkgPSBmdW5jdGlvbiAoKSB7XG5cdHZhciBzZWxmID0gdGhpcztcblx0dmFyIHByb3h5QXJncyA9IFtdO1xuXG5cdC8vYXJndW1lbnRzIGlzbnQgYWN0dWFsbHkgYW4gYXJyYXkuXG5cdGZvciAodmFyIGkgPSAwOyBpIDwgYXJndW1lbnRzLmxlbmd0aDsgaSsrKSB7XG5cdCAgICBwcm94eUFyZ3NbaV0gPSBhcmd1bWVudHNbaV07XG5cdH1cblxuXHR2YXIgZnVuY3Rpb25OYW1lID0gcHJveHlBcmdzLnNwbGljZSgwLCAxKVswXTtcblxuXHR2YXIgZnVuYyA9IGZ1bmN0aW9uKCkge1xuXHRcdHZhciBmdW5jQXJncyA9IFtdO1xuXHRcdGZvciAodmFyIGkgPSAwOyBpIDwgYXJndW1lbnRzLmxlbmd0aDsgaSsrKSB7XG5cdFx0ICAgIGZ1bmNBcmdzW2ldID0gYXJndW1lbnRzW2ldO1xuXHRcdH1cblx0XHR2YXIgYWxsQXJncyA9IHByb3h5QXJncy5jb25jYXQoZnVuY0FyZ3MpO1xuXG5cdFx0c2VsZltmdW5jdGlvbk5hbWVdLmFwcGx5KHNlbGYsIGFsbEFyZ3MpO1xuXHR9XG5cblx0cmV0dXJuIGZ1bmM7XG59XG5cblNlcmlhbFBvcnQucHJvdG90eXBlLnNldCA9IGZ1bmN0aW9uIChvcHRpb25zLCBjYWxsYmFjaykge1xuXHRjb25zb2xlLmxvZyhcIlNldHRpbmcgXCIsIG9wdGlvbnMpO1xuXHRjaHJvbWUuc2VyaWFsLnNldENvbnRyb2xTaWduYWxzKHRoaXMuY29ubmVjdGlvbklkLCBvcHRpb25zLCBmdW5jdGlvbihyZXN1bHQpe1xuXHRcdGlmKHJlc3VsdCkgY2FsbGJhY2soKTtcblx0XHRlbHNlIGNhbGxiYWNrKHJlc3VsdCk7XG5cdH0pO1xufTtcblxuZnVuY3Rpb24gU2VyaWFsUG9ydExpc3QoY2FsbGJhY2spIHtcblx0aWYgKHR5cGVvZiBjaHJvbWUgIT0gXCJ1bmRlZmluZWRcIiAmJiBjaHJvbWUuc2VyaWFsKSB7XG5cdFx0Y2hyb21lLnNlcmlhbC5nZXREZXZpY2VzKGZ1bmN0aW9uKHBvcnRzKSB7XG5cdFx0XHR2YXIgcG9ydE9iamVjdHMgPSBBcnJheShwb3J0cy5sZW5ndGgpO1xuXHRcdFx0Zm9yICh2YXIgaSA9IDA7IGkgPCBwb3J0cy5sZW5ndGg7IGkrKykge1xuXHRcdFx0XHRwb3J0T2JqZWN0c1tpXSA9IG5ldyBTZXJpYWxQb3J0KHBvcnRzW2ldLnBhdGgsIG51bGwsIGZhbHNlKTtcblx0XHRcdH1cblx0XHRcdGNhbGxiYWNrKG51bGwsIHBvcnRPYmplY3RzKTtcblx0XHR9KTtcblx0fSBlbHNlIHtcblx0XHRjYWxsYmFjayhcIk5vIGFjY2VzcyB0byBzZXJpYWwgcG9ydHMuIFRyeSBsb2FkaW5nIGFzIGEgQ2hyb21lIEFwcGxpY2F0aW9uLlwiLCBudWxsKTtcblx0fVxufTtcblxuLy8gQ29udmVydCBzdHJpbmcgdG8gQXJyYXlCdWZmZXJcbmZ1bmN0aW9uIHN0cjJhYihzdHIpIHtcblx0dmFyIGJ1ZiA9IG5ldyBBcnJheUJ1ZmZlcihzdHIubGVuZ3RoKTtcblx0dmFyIGJ1ZlZpZXcgPSBuZXcgVWludDhBcnJheShidWYpO1xuXHRmb3IgKHZhciBpID0gMDsgaSA8IHN0ci5sZW5ndGg7IGkrKykge1xuXHRcdGJ1ZlZpZXdbaV0gPSBzdHIuY2hhckNvZGVBdChpKTtcblx0fVxuXHRyZXR1cm4gYnVmO1xufVxuXG4vLyBDb252ZXJ0IGJ1ZmZlciB0byBBcnJheUJ1ZmZlclxuZnVuY3Rpb24gYnVmZmVyMkFycmF5QnVmZmVyKGJ1ZmZlcikge1xuXHR2YXIgYnVmID0gbmV3IEFycmF5QnVmZmVyKGJ1ZmZlci5sZW5ndGgpO1xuXHR2YXIgYnVmVmlldyA9IG5ldyBVaW50OEFycmF5KGJ1Zik7XG5cdGZvciAodmFyIGkgPSAwOyBpIDwgYnVmZmVyLmxlbmd0aDsgaSsrKSB7XG5cdFx0YnVmVmlld1tpXSA9IGJ1ZmZlcltpXTtcblx0fVxuXHRyZXR1cm4gYnVmO1xufVxuXG5mdW5jdGlvbiB0b0J1ZmZlcihhYikge1xuXHR2YXIgYnVmZmVyID0gbmV3IEJ1ZmZlcihhYi5ieXRlTGVuZ3RoKTtcblx0dmFyIHZpZXcgPSBuZXcgVWludDhBcnJheShhYik7XG5cdGZvciAodmFyIGkgPSAwOyBpIDwgYnVmZmVyLmxlbmd0aDsgKytpKSB7XG5cdCAgICBidWZmZXJbaV0gPSB2aWV3W2ldO1xuXHR9XG5cdHJldHVybiBidWZmZXI7XG59XG5cbm1vZHVsZS5leHBvcnRzID0ge1xuXHRTZXJpYWxQb3J0OiBTZXJpYWxQb3J0LFxuXHRsaXN0OiBTZXJpYWxQb3J0TGlzdCxcblx0dXNlZDogW10gLy9UT0RPOiBQb3B1bGF0ZSB0aGlzIHNvbWV3aGVyZS5cbn07XG5cbn0pLmNhbGwodGhpcyxyZXF1aXJlKFwiYnVmZmVyXCIpLkJ1ZmZlcikiLCIoZnVuY3Rpb24gKEJ1ZmZlcil7XG4vL0ludGVsIEhleCByZWNvcmQgdHlwZXNcclxuY29uc3QgREFUQSA9IDAsXHJcblx0RU5EX09GX0ZJTEUgPSAxLFxyXG5cdEVYVF9TRUdNRU5UX0FERFIgPSAyLFxyXG5cdFNUQVJUX1NFR01FTlRfQUREUiA9IDMsXHJcblx0RVhUX0xJTkVBUl9BRERSID0gNCxcclxuXHRTVEFSVF9MSU5FQVJfQUREUiA9IDU7XHJcblxyXG5jb25zdCBFTVBUWV9WQUxVRSA9IDB4RkY7XHJcblxyXG4vKiBpbnRlbF9oZXgucGFyc2UoZGF0YSlcclxuXHRgZGF0YWAgLSBJbnRlbCBIZXggZmlsZSAoc3RyaW5nIGluIEFTQ0lJIGZvcm1hdCBvciBCdWZmZXIgT2JqZWN0KVxyXG5cdGBidWZmZXJTaXplYCAtIHRoZSBzaXplIG9mIHRoZSBCdWZmZXIgY29udGFpbmluZyB0aGUgZGF0YSAob3B0aW9uYWwpXHJcblx0XHJcblx0cmV0dXJucyBhbiBPYmplY3Qgd2l0aCB0aGUgZm9sbG93aW5nIHByb3BlcnRpZXM6XHJcblx0XHQtIGRhdGEgLSBkYXRhIGFzIGEgQnVmZmVyIE9iamVjdCwgcGFkZGVkIHdpdGggMHhGRlxyXG5cdFx0XHR3aGVyZSBkYXRhIGlzIGVtcHR5LlxyXG5cdFx0LSBzdGFydFNlZ21lbnRBZGRyZXNzIC0gdGhlIGFkZHJlc3MgcHJvdmlkZWQgYnkgdGhlIGxhc3RcclxuXHRcdFx0c3RhcnQgc2VnbWVudCBhZGRyZXNzIHJlY29yZDsgbnVsbCwgaWYgbm90IGdpdmVuXHJcblx0XHQtIHN0YXJ0TGluZWFyQWRkcmVzcyAtIHRoZSBhZGRyZXNzIHByb3ZpZGVkIGJ5IHRoZSBsYXN0XHJcblx0XHRcdHN0YXJ0IGxpbmVhciBhZGRyZXNzIHJlY29yZDsgbnVsbCwgaWYgbm90IGdpdmVuXHJcblx0U3BlY2lhbCB0aGFua3MgdG86IGh0dHA6Ly9lbi53aWtpcGVkaWEub3JnL3dpa2kvSW50ZWxfSEVYXHJcbiovXHJcbmV4cG9ydHMucGFyc2UgPSBmdW5jdGlvbiBwYXJzZUludGVsSGV4KGRhdGEsIGJ1ZmZlclNpemUpIHtcclxuXHRpZihkYXRhIGluc3RhbmNlb2YgQnVmZmVyKVxyXG5cdFx0ZGF0YSA9IGRhdGEudG9TdHJpbmcoXCJhc2NpaVwiKTtcclxuXHQvL0luaXRpYWxpemF0aW9uXHJcblx0dmFyIGJ1ZiA9IG5ldyBCdWZmZXIoYnVmZmVyU2l6ZSB8fCA4MTkyKSxcclxuXHRcdGJ1Zkxlbmd0aCA9IDAsIC8vTGVuZ3RoIG9mIGRhdGEgaW4gdGhlIGJ1ZmZlclxyXG5cdFx0aGlnaEFkZHJlc3MgPSAwLCAvL3VwcGVyIGFkZHJlc3NcclxuXHRcdHN0YXJ0U2VnbWVudEFkZHJlc3MgPSBudWxsLFxyXG5cdFx0c3RhcnRMaW5lYXJBZGRyZXNzID0gbnVsbCxcclxuXHRcdGxpbmVOdW0gPSAwLCAvL0xpbmUgbnVtYmVyIGluIHRoZSBJbnRlbCBIZXggc3RyaW5nXHJcblx0XHRwb3MgPSAwOyAvL0N1cnJlbnQgcG9zaXRpb24gaW4gdGhlIEludGVsIEhleCBzdHJpbmdcclxuXHRjb25zdCBTTUFMTEVTVF9MSU5FID0gMTE7XHJcblx0d2hpbGUocG9zICsgU01BTExFU1RfTElORSA8PSBkYXRhLmxlbmd0aClcclxuXHR7XHJcblx0XHQvL1BhcnNlIGFuIGVudGlyZSBsaW5lXHJcblx0XHRpZihkYXRhLmNoYXJBdChwb3MrKykgIT0gXCI6XCIpXHJcblx0XHRcdHRocm93IG5ldyBFcnJvcihcIkxpbmUgXCIgKyAobGluZU51bSsxKSArXHJcblx0XHRcdFx0XCIgZG9lcyBub3Qgc3RhcnQgd2l0aCBhIGNvbG9uICg6KS5cIik7XHJcblx0XHRlbHNlXHJcblx0XHRcdGxpbmVOdW0rKztcclxuXHRcdC8vTnVtYmVyIG9mIGJ5dGVzIChoZXggZGlnaXQgcGFpcnMpIGluIHRoZSBkYXRhIGZpZWxkXHJcblx0XHR2YXIgZGF0YUxlbmd0aCA9IHBhcnNlSW50KGRhdGEuc3Vic3RyKHBvcywgMiksIDE2KTtcclxuXHRcdHBvcyArPSAyO1xyXG5cdFx0Ly9HZXQgMTYtYml0IGFkZHJlc3MgKGJpZy1lbmRpYW4pXHJcblx0XHR2YXIgbG93QWRkcmVzcyA9IHBhcnNlSW50KGRhdGEuc3Vic3RyKHBvcywgNCksIDE2KTtcclxuXHRcdHBvcyArPSA0O1xyXG5cdFx0Ly9SZWNvcmQgdHlwZVxyXG5cdFx0dmFyIHJlY29yZFR5cGUgPSBwYXJzZUludChkYXRhLnN1YnN0cihwb3MsIDIpLCAxNik7XHJcblx0XHRwb3MgKz0gMjtcclxuXHRcdC8vRGF0YSBmaWVsZCAoaGV4LWVuY29kZWQgc3RyaW5nKVxyXG5cdFx0dmFyIGRhdGFGaWVsZCA9IGRhdGEuc3Vic3RyKHBvcywgZGF0YUxlbmd0aCAqIDIpLFxyXG5cdFx0XHRkYXRhRmllbGRCdWYgPSBuZXcgQnVmZmVyKGRhdGFGaWVsZCwgXCJoZXhcIik7XHJcblx0XHRwb3MgKz0gZGF0YUxlbmd0aCAqIDI7XHJcblx0XHQvL0NoZWNrc3VtXHJcblx0XHR2YXIgY2hlY2tzdW0gPSBwYXJzZUludChkYXRhLnN1YnN0cihwb3MsIDIpLCAxNik7XHJcblx0XHRwb3MgKz0gMjtcclxuXHRcdC8vVmFsaWRhdGUgY2hlY2tzdW1cclxuXHRcdHZhciBjYWxjQ2hlY2tzdW0gPSAoZGF0YUxlbmd0aCArIChsb3dBZGRyZXNzID4+IDgpICtcclxuXHRcdFx0bG93QWRkcmVzcyArIHJlY29yZFR5cGUpICYgMHhGRjtcclxuXHRcdGZvcih2YXIgaSA9IDA7IGkgPCBkYXRhTGVuZ3RoOyBpKyspXHJcblx0XHRcdGNhbGNDaGVja3N1bSA9IChjYWxjQ2hlY2tzdW0gKyBkYXRhRmllbGRCdWZbaV0pICYgMHhGRjtcclxuXHRcdGNhbGNDaGVja3N1bSA9ICgweDEwMCAtIGNhbGNDaGVja3N1bSkgJiAweEZGO1xyXG5cdFx0aWYoY2hlY2tzdW0gIT0gY2FsY0NoZWNrc3VtKVxyXG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoXCJJbnZhbGlkIGNoZWNrc3VtIG9uIGxpbmUgXCIgKyBsaW5lTnVtICtcclxuXHRcdFx0XHRcIjogZ290IFwiICsgY2hlY2tzdW0gKyBcIiwgYnV0IGV4cGVjdGVkIFwiICsgY2FsY0NoZWNrc3VtKTtcclxuXHRcdC8vUGFyc2UgdGhlIHJlY29yZCBiYXNlZCBvbiBpdHMgcmVjb3JkVHlwZVxyXG5cdFx0c3dpdGNoKHJlY29yZFR5cGUpXHJcblx0XHR7XHJcblx0XHRcdGNhc2UgREFUQTpcclxuXHRcdFx0XHR2YXIgYWJzb2x1dGVBZGRyZXNzID0gaGlnaEFkZHJlc3MgKyBsb3dBZGRyZXNzO1xyXG5cdFx0XHRcdC8vRXhwYW5kIGJ1ZiwgaWYgbmVjZXNzYXJ5XHJcblx0XHRcdFx0aWYoYWJzb2x1dGVBZGRyZXNzICsgZGF0YUxlbmd0aCA+PSBidWYubGVuZ3RoKVxyXG5cdFx0XHRcdHtcclxuXHRcdFx0XHRcdHZhciB0bXAgPSBuZXcgQnVmZmVyKChhYnNvbHV0ZUFkZHJlc3MgKyBkYXRhTGVuZ3RoKSAqIDIpO1xyXG5cdFx0XHRcdFx0YnVmLmNvcHkodG1wLCAwLCAwLCBidWZMZW5ndGgpO1xyXG5cdFx0XHRcdFx0YnVmID0gdG1wO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0XHQvL1dyaXRlIG92ZXIgc2tpcHBlZCBieXRlcyB3aXRoIEVNUFRZX1ZBTFVFXHJcblx0XHRcdFx0aWYoYWJzb2x1dGVBZGRyZXNzID4gYnVmTGVuZ3RoKVxyXG5cdFx0XHRcdFx0YnVmLmZpbGwoRU1QVFlfVkFMVUUsIGJ1Zkxlbmd0aCwgYWJzb2x1dGVBZGRyZXNzKTtcclxuXHRcdFx0XHQvL1dyaXRlIHRoZSBkYXRhRmllbGRCdWYgdG8gYnVmXHJcblx0XHRcdFx0ZGF0YUZpZWxkQnVmLmNvcHkoYnVmLCBhYnNvbHV0ZUFkZHJlc3MpO1xyXG5cdFx0XHRcdGJ1Zkxlbmd0aCA9IE1hdGgubWF4KGJ1Zkxlbmd0aCwgYWJzb2x1dGVBZGRyZXNzICsgZGF0YUxlbmd0aCk7XHJcblx0XHRcdFx0YnJlYWs7XHJcblx0XHRcdGNhc2UgRU5EX09GX0ZJTEU6XHJcblx0XHRcdFx0aWYoZGF0YUxlbmd0aCAhPSAwKVxyXG5cdFx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKFwiSW52YWxpZCBFT0YgcmVjb3JkIG9uIGxpbmUgXCIgK1xyXG5cdFx0XHRcdFx0XHRsaW5lTnVtICsgXCIuXCIpO1xyXG5cdFx0XHRcdHJldHVybiB7XHJcblx0XHRcdFx0XHRcImRhdGFcIjogYnVmLnNsaWNlKDAsIGJ1Zkxlbmd0aCksXHJcblx0XHRcdFx0XHRcInN0YXJ0U2VnbWVudEFkZHJlc3NcIjogc3RhcnRTZWdtZW50QWRkcmVzcyxcclxuXHRcdFx0XHRcdFwic3RhcnRMaW5lYXJBZGRyZXNzXCI6IHN0YXJ0TGluZWFyQWRkcmVzc1xyXG5cdFx0XHRcdH07XHJcblx0XHRcdFx0YnJlYWs7XHJcblx0XHRcdGNhc2UgRVhUX1NFR01FTlRfQUREUjpcclxuXHRcdFx0XHRpZihkYXRhTGVuZ3RoICE9IDIgfHwgbG93QWRkcmVzcyAhPSAwKVxyXG5cdFx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKFwiSW52YWxpZCBleHRlbmRlZCBzZWdtZW50IGFkZHJlc3MgcmVjb3JkIG9uIGxpbmUgXCIgK1xyXG5cdFx0XHRcdFx0XHRsaW5lTnVtICsgXCIuXCIpO1xyXG5cdFx0XHRcdGhpZ2hBZGRyZXNzID0gcGFyc2VJbnQoZGF0YUZpZWxkLCAxNikgPDwgNDtcclxuXHRcdFx0XHRicmVhaztcclxuXHRcdFx0Y2FzZSBTVEFSVF9TRUdNRU5UX0FERFI6XHJcblx0XHRcdFx0aWYoZGF0YUxlbmd0aCAhPSA0IHx8IGxvd0FkZHJlc3MgIT0gMClcclxuXHRcdFx0XHRcdHRocm93IG5ldyBFcnJvcihcIkludmFsaWQgc3RhcnQgc2VnbWVudCBhZGRyZXNzIHJlY29yZCBvbiBsaW5lIFwiICtcclxuXHRcdFx0XHRcdFx0bGluZU51bSArIFwiLlwiKTtcclxuXHRcdFx0XHRzdGFydFNlZ21lbnRBZGRyZXNzID0gcGFyc2VJbnQoZGF0YUZpZWxkLCAxNik7XHJcblx0XHRcdFx0YnJlYWs7XHJcblx0XHRcdGNhc2UgRVhUX0xJTkVBUl9BRERSOlxyXG5cdFx0XHRcdGlmKGRhdGFMZW5ndGggIT0gMiB8fCBsb3dBZGRyZXNzICE9IDApXHJcblx0XHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoXCJJbnZhbGlkIGV4dGVuZGVkIGxpbmVhciBhZGRyZXNzIHJlY29yZCBvbiBsaW5lIFwiICtcclxuXHRcdFx0XHRcdFx0bGluZU51bSArIFwiLlwiKTtcclxuXHRcdFx0XHRoaWdoQWRkcmVzcyA9IHBhcnNlSW50KGRhdGFGaWVsZCwgMTYpIDw8IDE2O1xyXG5cdFx0XHRcdGJyZWFrO1xyXG5cdFx0XHRjYXNlIFNUQVJUX0xJTkVBUl9BRERSOlxyXG5cdFx0XHRcdGlmKGRhdGFMZW5ndGggIT0gNCB8fCBsb3dBZGRyZXNzICE9IDApXHJcblx0XHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoXCJJbnZhbGlkIHN0YXJ0IGxpbmVhciBhZGRyZXNzIHJlY29yZCBvbiBsaW5lIFwiICtcclxuXHRcdFx0XHRcdFx0bGluZU51bSArIFwiLlwiKTtcclxuXHRcdFx0XHRzdGFydExpbmVhckFkZHJlc3MgPSBwYXJzZUludChkYXRhRmllbGQsIDE2KTtcclxuXHRcdFx0XHRicmVhaztcclxuXHRcdFx0ZGVmYXVsdDpcclxuXHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoXCJJbnZhbGlkIHJlY29yZCB0eXBlIChcIiArIHJlY29yZFR5cGUgK1xyXG5cdFx0XHRcdFx0XCIpIG9uIGxpbmUgXCIgKyBsaW5lTnVtKTtcclxuXHRcdFx0XHRicmVhaztcclxuXHRcdH1cclxuXHRcdC8vQWR2YW5jZSB0byB0aGUgbmV4dCBsaW5lXHJcblx0XHRpZihkYXRhLmNoYXJBdChwb3MpID09IFwiXFxyXCIpXHJcblx0XHRcdHBvcysrO1xyXG5cdFx0aWYoZGF0YS5jaGFyQXQocG9zKSA9PSBcIlxcblwiKVxyXG5cdFx0XHRwb3MrKztcclxuXHR9XHJcblx0dGhyb3cgbmV3IEVycm9yKFwiVW5leHBlY3RlZCBlbmQgb2YgaW5wdXQ6IG1pc3Npbmcgb3IgaW52YWxpZCBFT0YgcmVjb3JkLlwiKTtcclxufTtcbn0pLmNhbGwodGhpcyxyZXF1aXJlKFwiYnVmZmVyXCIpLkJ1ZmZlcikiLCIoZnVuY3Rpb24gKEJ1ZmZlcil7XG4vL3VzZSBzdHJpY3QgbWlnaHQgaGF2ZSBzY3Jld2VkIHVwIG15IHRoaXMgY29udGV4dCwgb3IgbWlnaHQgbm90IGhhdmUuLiBcbi8vIHZhciBzZXJpYWxQb3J0ID0gcmVxdWlyZShcInNlcmlhbHBvcnRcIik7XG52YXIgYXN5bmMgPSByZXF1aXJlKFwiYXN5bmNcIik7XG52YXIgYnVmZmVyRXF1YWwgPSByZXF1aXJlKCdidWZmZXItZXF1YWwnKTtcblxudmFyIENtbmRfU1RLX0dFVF9TWU5DID0gMHgzMDtcbnZhciBDbW5kX1NUS19TRVRfREVWSUNFID0gMHg0MjtcbnZhciBDbW5kX1NUS19FTlRFUl9QUk9HTU9ERSA9IDB4NTA7XG52YXIgQ21uZF9TVEtfTE9BRF9BRERSRVNTID0gMHg1NTtcbnZhciBDbW5kX1NUS19QUk9HX1BBR0UgPSAweDY0O1xudmFyIENtbmRfU1RLX0xFQVZFX1BST0dNT0RFID0gMHg1MTtcblxudmFyIFN5bmNfQ1JDX0VPUCA9IDB4MjA7XG5cbnZhciBSZXNwX1NUS19PSyA9IDB4MTA7XG52YXIgUmVzcF9TVEtfSU5TWU5DID0gMHgxNDtcblxudmFyIG1lbXR5cGUgPSAweDQ2O1xudmFyIHRpbWVvdXQgPSAyMDA7XG5cbi8vdG9kbyBhYnN0cmFjdCBvdXQgY2hyb21lIGFuZCB0YWtlIHNlcmlhbCBvYmplY3Qgc2hpbVxuZnVuY3Rpb24gc3RrNTAwKHBvcnQpIHtcblx0Ly8gaWYgKCEodGhpcyBpbnN0YW5jZW9mIHN0azUwMCkpIFxuXHQvLyByZXR1cm4gbmV3IHN0azUwMCgpO1xuXG5cdGNvbnNvbGUubG9nKFwiY29uc3RydWN0ZWRcIik7XG5cblx0dGhpcy5zZXJpYWxQb3J0ID0gcG9ydDtcblxuXHR0aGlzLmJ1ZmZlciA9IG5ldyBCdWZmZXIoMzAwKTtcblxuXHR0aGlzLmJ1ZmZlclNpemUgPSAwO1xuXG59O1xuXG5zdGs1MDAucHJvdG90eXBlLm1hdGNoUmVjZWl2ZSA9IGZ1bmN0aW9uKGJ1ZmZlciwgdGltZW91dCwgY2FsbGJhY2spe1xuXHRjb25zb2xlLmxvZyhcIm1hdGNoaW5nXCIpO1xuXHRjb25zb2xlLmxvZyhidWZmZXIudG9TdHJpbmcoJ2hleCcpKTtcblxuXHR2YXIgc2VsZiA9IHRoaXM7XG5cblx0dmFyIGVsYXBzZWQgPSAwO1xuXHR2YXIgaW50ZXJ2YWwgPSAxMDtcblxuXHR2YXIgdGltZXIgPSBzZXRJbnRlcnZhbChjaGVjaywgaW50ZXJ2YWwpO1xuXG5cdGZ1bmN0aW9uIGNoZWNrKCl7XG5cdFx0aWYoZWxhcHNlZD50aW1lb3V0KXtcblx0XHRcdGNsZWFySW50ZXJ2YWwodGltZXIpO1xuXHRcdFx0c2VsZi5idWZmZXIgPSBuZXcgQnVmZmVyKDMwMCk7XG5cdFx0XHRzZWxmLmJ1ZmZlclNpemUgPSAwO1xuXHRcdFx0Y2FsbGJhY2soXCJ0aW1lZCBvdXQgYWZ0ZXIgXCIgKyBlbGFwc2VkICsgXCJtc1wiKTtcblx0XHR9XG5cdFx0Ly8gY29uc29sZS5sb2coZWxhcHNlZCk7XG5cdFx0ZWxhcHNlZCA9IGVsYXBzZWQgKyBpbnRlcnZhbDtcblxuXHRcdGlmKHNlbGYuYnVmZmVyU2l6ZT49YnVmZmVyLmxlbmd0aCl7XG5cdFx0XHRjb25zb2xlLmxvZyhidWZmZXJFcXVhbChzZWxmLmJ1ZmZlci5zbGljZSgwLGJ1ZmZlci5sZW5ndGgpLCBidWZmZXIpKTtcblx0XHRcdGlmKGJ1ZmZlckVxdWFsKHNlbGYuYnVmZmVyLnNsaWNlKDAsYnVmZmVyLmxlbmd0aCksIGJ1ZmZlcikpe1xuXHRcdFx0XHRzZWxmLmJ1ZmZlciA9IG5ldyBCdWZmZXIoMzAwKTtcblx0XHRcdFx0c2VsZi5idWZmZXJTaXplID0gMDtcblx0XHRcdFx0Y2xlYXJJbnRlcnZhbCh0aW1lcik7XG5cdFx0XHRcdGNhbGxiYWNrKG51bGwpO1xuXHRcdFx0fVxuXHRcdFx0ZWxzZXtcblx0XHRcdFx0dmFyIGJ1ZmZlcl9jb3B5ID0gbmV3IEJ1ZmZlcihzZWxmLmJ1ZmZlclNpemUpO1xuXHRcdFx0XHRzZWxmLmJ1ZmZlci5jb3B5KGJ1ZmZlcl9jb3B5KTtcblx0XHRcdFx0c2VsZi5idWZmZXIgPSBuZXcgQnVmZmVyKDMwMCk7XG5cdFx0XHRcdHNlbGYuYnVmZmVyU2l6ZSA9IDA7XG5cdFx0XHRcdGNsZWFySW50ZXJ2YWwodGltZXIpO1xuXHRcdFx0XHRjYWxsYmFjayhidWZmZXJfY29weSk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG59O1xuXG4vL3RvZG8gdXNlIGVycm9yXG5zdGs1MDAucHJvdG90eXBlLmNvbm5lY3QgPSBmdW5jdGlvbihkb25lKSB7XG5cdGNvbnNvbGUubG9nKFwiY29ubmVjdFwiKTtcblxuXHR2YXIgc2VsZiA9IHRoaXM7XG5cblx0dGhpcy5zZXJpYWxQb3J0Lm9wZW4oZnVuY3Rpb24gKGVycm9yKSB7XG5cblx0ICBpZiAoIGVycm9yICkge1xuXHQgICAgY29uc29sZS5sb2coJ2ZhaWxlZCB0byBjb25uZWN0OiAnICsgZXJyb3IpO1xuXHQgICAgZG9uZShlcnJvcik7XG5cdCAgfSBlbHNlIHtcblx0ICAgIGNvbnNvbGUubG9nKCdjb25uZWN0ZWQnKTtcblx0ICAgIHNlbGYuc2VyaWFsUG9ydC5vbignZGF0YScsIGZ1bmN0aW9uKGRhdGEpIHtcblx0ICAgICAgY29uc29sZS5sb2coXCJyZWNlaXZlZCBcIiArIGRhdGEudG9TdHJpbmcoJ2hleCcpKTtcblx0ICAgICAgZGF0YS5jb3B5KHNlbGYuYnVmZmVyLCBzZWxmLmJ1ZmZlclNpemUpO1xuXHQgICAgICBzZWxmLmJ1ZmZlclNpemUgPSBzZWxmLmJ1ZmZlclNpemUgKyBkYXRhLmxlbmd0aDtcblx0ICAgIH0pO1xuXHQgICAgZG9uZSgpO1xuXHQgIH1cblx0fSk7XG5cbn07XG5cbi8vdG9kbyBjYW4gdGhpcyB0aW1lb3V0PyBvciBmYWlsP1xuc3RrNTAwLnByb3RvdHlwZS5kaXNjb25uZWN0ID0gZnVuY3Rpb24oZG9uZSkge1xuXHRjb25zb2xlLmxvZyhcImRpc2Nvbm5lY3RcIik7XG5cblx0dmFyIHNlbGYgPSB0aGlzO1xuXG5cdHNlbGYuc2VyaWFsUG9ydC5jbG9zZShmdW5jdGlvbiAoZXJyb3IpIHtcblx0ICBpZiAoIGVycm9yICkge1xuXHQgICAgY29uc29sZS5sb2coJ2ZhaWxlZCB0byBjbG9zZTogJyArIGVycm9yKTtcblx0ICAgIGRvbmUoZXJyb3IpO1xuXHQgIH0gZWxzZSB7XG5cdCAgICBjb25zb2xlLmxvZygnY2xvc2VkJyk7XG5cdCAgICBkb25lKCk7XG5cdCAgfVxuXHR9KTtcblxufTtcblxuc3RrNTAwLnByb3RvdHlwZS5yZXNldCA9IGZ1bmN0aW9uKGRlbGF5MSwgZGVsYXkyLCBkb25lKXtcblx0Y29uc29sZS5sb2coXCJyZXNldFwiKTtcblxuXHR2YXIgc2VsZiA9IHRoaXM7XG5cblx0YXN5bmMuc2VyaWVzKFtcblx0ICBmdW5jdGlvbihjYmRvbmUpIHtcblx0ICBcdGNvbnNvbGUubG9nKFwiYXNzZXJ0aW5nXCIpO1xuXHQgICAgc2VsZi5zZXJpYWxQb3J0LnNldCh7cnRzOnRydWUsIGR0cjp0cnVlfSwgZnVuY3Rpb24ocmVzdWx0KXtcblx0ICAgIFx0Y29uc29sZS5sb2coXCJhc3NlcnRlZFwiKTtcblx0ICAgIFx0aWYocmVzdWx0KSBjYmRvbmUocmVzdWx0KTtcblx0ICAgIFx0ZWxzZSBjYmRvbmUoKTtcblx0ICAgIH0pO1xuXHQgIH0sXG5cdCAgZnVuY3Rpb24oY2Jkb25lKSB7XG5cdCAgXHRjb25zb2xlLmxvZyhcIndhaXRcIik7XG5cdCAgICBzZXRUaW1lb3V0KGNiZG9uZSwgZGVsYXkxKTtcblx0ICB9LFxuXHQgIGZ1bmN0aW9uKGNiZG9uZSkge1xuXHQgIFx0Y29uc29sZS5sb2coXCJjbGVhcmluZ1wiKTtcblx0ICAgIHNlbGYuc2VyaWFsUG9ydC5zZXQoe3J0czpmYWxzZSwgZHRyOmZhbHNlfSwgZnVuY3Rpb24ocmVzdWx0KXtcblx0ICAgIFx0Y29uc29sZS5sb2coXCJjbGVhclwiKTtcblx0ICAgIFx0aWYocmVzdWx0KSBjYmRvbmUocmVzdWx0KTtcblx0ICAgIFx0ZWxzZSBjYmRvbmUoKTtcblx0ICAgIH0pO1xuXHQgIH0sXG5cdCAgZnVuY3Rpb24oY2Jkb25lKSB7XG5cdCAgXHRjb25zb2xlLmxvZyhcIndhaXRcIik7XG5cdCAgICBzZXRUaW1lb3V0KGNiZG9uZSwgZGVsYXkyKTtcblx0ICB9XSxcblx0XHRmdW5jdGlvbihlcnJvcikge1xuXHRcdFx0ZG9uZShlcnJvcik7XG5cdFx0fVxuXHQpO1xufTtcblxuc3RrNTAwLnByb3RvdHlwZS5zeW5jID0gZnVuY3Rpb24oYXR0ZW1wdHMsIGRvbmUpIHtcblx0Y29uc29sZS5sb2coXCJzeW5jXCIpO1xuXHR2YXIgc2VsZiA9IHRoaXM7XG5cdHZhciB0cmllcyA9IDE7XG5cblx0dmFyIGNtZCA9IG5ldyBCdWZmZXIoW0NtbmRfU1RLX0dFVF9TWU5DLCBTeW5jX0NSQ19FT1BdKTtcblxuXHRhdHRlbXB0KCk7XG5cdGZ1bmN0aW9uIGF0dGVtcHQoKXtcblx0XHR0cmllcz10cmllcysxO1xuXHRcdGNvbnNvbGUubG9nKGNtZC50b1N0cmluZygnaGV4JykpO1xuXHRcdHNlbGYuc2VyaWFsUG9ydC53cml0ZShjbWQsIGZ1bmN0aW9uKGVycm9yLCByZXN1bHRzKXtcblx0XHRcdGNvbnNvbGUubG9nKFwiY29uZmlybSBzeW5jXCIpO1xuXHRcdFx0c2VsZi5tYXRjaFJlY2VpdmUobmV3IEJ1ZmZlcihbUmVzcF9TVEtfSU5TWU5DLCBSZXNwX1NUS19PS10pLCB0aW1lb3V0LCBmdW5jdGlvbihlcnJvcil7XG5cdFx0XHRcdGlmKGVycm9yKSB7XG5cdFx0XHRcdFx0aWYodHlwZW9mIGVycm9yID09PSBCdWZmZXIpe1xuXHRcdFx0XHRcdFx0Y29uc29sZS5sb2coXCJubyBtYXRjaFwiKTtcblx0XHRcdFx0XHRcdGRvbmUoZXJyb3IpO1xuXHRcdFx0XHRcdH1lbHNlIGlmKHRyaWVzPD1hdHRlbXB0cyl7XG5cdFx0XHRcdFx0XHRjb25zb2xlLmxvZyhcImZhaWxlZCBhdHRlbXB0IGFnYWluXCIpO1xuXHRcdFx0XHRcdFx0YXR0ZW1wdCgpO1xuXHRcdFx0XHRcdH1lbHNle1xuXHRcdFx0XHRcdFx0Y29uc29sZS5sb2coXCJmYWlsZWQgYWxsIGF0dGVtcHRzXCIpO1xuXHRcdFx0XHRcdFx0ZG9uZShcIm5vIHJlc3BvbnNlXCIpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fWVsc2V7XG5cdFx0XHRcdFx0Y29uc29sZS5sb2coXCJjb25maXJtZWQgc3luY1wiKTtcblx0XHRcdFx0XHRkb25lKCk7XG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXHRcdH0pO1xuXHR9XG59O1xuXG5zdGs1MDAucHJvdG90eXBlLnNldE9wdGlvbnMgPSBmdW5jdGlvbihvcHRpb25zLCBkb25lKSB7XG5cdGNvbnNvbGUubG9nKFwic2V0IGRldmljZVwiKTtcblx0dmFyIHNlbGYgPSB0aGlzO1xuXHR2YXIgY21kID0gbmV3IEJ1ZmZlcihbQ21uZF9TVEtfU0VUX0RFVklDRSwgb3B0aW9ucy5kZXZpY2Vjb2RlLCBvcHRpb25zLnJldmlzaW9uLCBvcHRpb25zLnByb2d0eXBlLCBvcHRpb25zLnBhcm1vZGUsIG9wdGlvbnMucG9sbGluZywgb3B0aW9ucy5zZWxmdGltZWQsIG9wdGlvbnMubG9ja2J5dGVzLCBvcHRpb25zLmZ1c2VieXRlcywgb3B0aW9ucy5mbGFzaHBvbGx2YWwxLCBvcHRpb25zLmZsYXNocG9sbHZhbDIsIG9wdGlvbnMuZWVwcm9tcG9sbHZhbDEsIG9wdGlvbnMuZWVwcm9tcG9sbHZhbDIsIG9wdGlvbnMucGFnZXNpemVoaWdoLCBvcHRpb25zLnBhZ2VzaXplbG93LCBvcHRpb25zLmVlcHJvbXNpemVoaWdoLCBvcHRpb25zLmVlcHJvbXNpemVsb3csIG9wdGlvbnMuZmxhc2hzaXplNCwgb3B0aW9ucy5mbGFzaHNpemUzLCBvcHRpb25zLmZsYXNoc2l6ZTIsIG9wdGlvbnMuZmxhc2hzaXplMSwgU3luY19DUkNfRU9QXSk7XG5cdGNvbnNvbGUubG9nKGNtZC50b1N0cmluZygnaGV4JykpO1xuXHR0aGlzLnNlcmlhbFBvcnQud3JpdGUoY21kLCBmdW5jdGlvbihlcnJvciwgcmVzdWx0cyl7XG5cdFx0Y29uc29sZS5sb2coXCJjb25maXJtIHNldCBkZXZpY2VcIik7XHRcdFxuXHRcdFx0c2VsZi5tYXRjaFJlY2VpdmUobmV3IEJ1ZmZlcihbUmVzcF9TVEtfSU5TWU5DLCBSZXNwX1NUS19PS10pLCB0aW1lb3V0LCBmdW5jdGlvbihlcnJvcil7XG5cdFx0XHRcdGRvbmUoZXJyb3IpO1xuXHRcdH0pO1xuXHR9KTtcbn07XG5cblxuc3RrNTAwLnByb3RvdHlwZS5lbnRlclByb2dyYW1taW5nTW9kZSA9IGZ1bmN0aW9uKGRvbmUpIHtcblx0Y29uc29sZS5sb2coXCJzZW5kIGVudGVyIHByb2dyYW1taW5nIG1vZGVcIik7XG5cdHZhciBzZWxmID0gdGhpcztcblx0dmFyIGNtZCA9IG5ldyBCdWZmZXIoW0NtbmRfU1RLX0VOVEVSX1BST0dNT0RFLCBTeW5jX0NSQ19FT1BdKTtcblx0Y29uc29sZS5sb2coY21kLnRvU3RyaW5nKCdoZXgnKSk7XG5cdHRoaXMuc2VyaWFsUG9ydC53cml0ZShjbWQsIGZ1bmN0aW9uKGVycm9yLCByZXN1bHRzKSB7XG5cdFx0Y29uc29sZS5sb2coXCJzZW50IGVudGVyIHByb2dyYW1taW5nIG1vZGVcIik7XG5cdFx0c2VsZi5tYXRjaFJlY2VpdmUobmV3IEJ1ZmZlcihbUmVzcF9TVEtfSU5TWU5DLCBSZXNwX1NUS19PS10pLCB0aW1lb3V0LCBmdW5jdGlvbihlcnJvcil7XG5cdCAgXHRkb25lKGVycm9yKTtcblx0XHR9KTtcblx0fSk7XG59O1xuXG5cbnN0azUwMC5wcm90b3R5cGUubG9hZEFkZHJlc3MgPSBmdW5jdGlvbih1c2VhZGRyLCBkb25lKSB7XG5cdGNvbnNvbGUubG9nKFwibG9hZCBhZGRyZXNzXCIpO1xuXHR2YXIgc2VsZiA9IHRoaXM7XG5cblx0dmFyIGFkZHJfbG93ID0gdXNlYWRkciAmIDB4ZmY7XG5cdHZhciBhZGRyX2hpZ2ggPSAodXNlYWRkciA+PiA4KSAmIDB4ZmY7XG5cblx0dmFyIGNtZCA9IG5ldyBCdWZmZXIoW0NtbmRfU1RLX0xPQURfQUREUkVTUywgYWRkcl9sb3csIGFkZHJfaGlnaCwgU3luY19DUkNfRU9QXSk7XG5cdGNvbnNvbGUubG9nKGNtZC50b1N0cmluZygnaGV4JykpO1xuXG5cdHRoaXMuc2VyaWFsUG9ydC53cml0ZShjbWQsIGZ1bmN0aW9uKGVycm9yLCByZXN1bHRzKSB7XG5cdFx0Y29uc29sZS5sb2coXCJjb25maXJtIGxvYWQgYWRkcmVzc1wiKTtcbiAgXHRzZWxmLm1hdGNoUmVjZWl2ZShuZXcgQnVmZmVyKFtSZXNwX1NUS19JTlNZTkMsIFJlc3BfU1RLX09LXSksIHRpbWVvdXQsIGZ1bmN0aW9uKGVycm9yKXtcbiAgXHRcdGRvbmUoZXJyb3IpO1xuICBcdH0pO1xuXG5cdH0pO1xuXG59O1xuXG5cbnN0azUwMC5wcm90b3R5cGUubG9hZFBhZ2UgPSBmdW5jdGlvbih3cml0ZUJ5dGVzLCBkb25lKSB7XG5cdGNvbnNvbGUubG9nKFwibG9hZCBwYWdlXCIpO1xuXHR2YXIgc2VsZiA9IHRoaXM7XG5cblx0dmFyIGJ5dGVzX2xvdyA9IHdyaXRlQnl0ZXMubGVuZ3RoICYgMHhmZjtcblx0dmFyIGJ5dGVzX2hpZ2ggPSB3cml0ZUJ5dGVzLmxlbmd0aCA+PiA4O1xuXG5cdHZhciBjbWQgPSBuZXcgQnVmZmVyKFtDbW5kX1NUS19QUk9HX1BBR0UsIGJ5dGVzX2hpZ2gsIGJ5dGVzX2xvdywgbWVtdHlwZV0pO1xuXHRjbWQgPSBCdWZmZXIuY29uY2F0KFtjbWQsd3JpdGVCeXRlc10pO1xuXHR2YXIgZW5kID0gbmV3IEJ1ZmZlcihbU3luY19DUkNfRU9QXSk7XG5cdGNtZCA9IEJ1ZmZlci5jb25jYXQoW2NtZCxlbmRdKTtcblx0Y29uc29sZS5sb2coY21kLnRvU3RyaW5nKCdoZXgnKSk7XG5cblx0dGhpcy5zZXJpYWxQb3J0LndyaXRlKGNtZCwgZnVuY3Rpb24oZXJyb3IsIHJlc3VsdHMpIHtcblx0XHRjb25zb2xlLmxvZyhcImxvYWRlZCBwYWdlXCIpO1xuXG5cdFx0c2VsZi5tYXRjaFJlY2VpdmUobmV3IEJ1ZmZlcihbUmVzcF9TVEtfSU5TWU5DLCBSZXNwX1NUS19PS10pLCB0aW1lb3V0LCBmdW5jdGlvbihlcnJvcil7XG5cdFx0XHRkb25lKGVycm9yKTtcblx0XHR9KTtcblxuXHR9KTtcbn07XG5cbnN0azUwMC5wcm90b3R5cGUudXBsb2FkID0gZnVuY3Rpb24oaGV4LCBwYWdlU2l6ZSwgZG9uZSkge1xuXHRjb25zb2xlLmxvZyhcInByb2dyYW1cIik7XG5cblx0dmFyIHBhZ2VhZGRyID0gMDtcblx0dmFyIHdyaXRlQnl0ZXM7XG5cdHZhciB1c2VhZGRyO1xuXG5cdHZhciBzZWxmID0gdGhpcztcblxuXHQvLyBwcm9ncmFtIGluZGl2aWR1YWwgcGFnZXNcbiAgYXN5bmMud2hpbHN0KFxuICAgIGZ1bmN0aW9uKCkgeyByZXR1cm4gcGFnZWFkZHIgPCBoZXgubGVuZ3RoOyB9LFxuICAgIGZ1bmN0aW9uKHBhZ2Vkb25lKSB7XG5cdFx0XHRjb25zb2xlLmxvZyhcInByb2dyYW0gcGFnZVwiKTtcbiAgICAgIGFzeW5jLnNlcmllcyhbXG4gICAgICBcdGZ1bmN0aW9uKGNiZG9uZSl7XG4gICAgICBcdFx0dXNlYWRkciA9IHBhZ2VhZGRyID4+IDE7XG4gICAgICBcdFx0Y2Jkb25lKCk7XG4gICAgICBcdH0sXG4gICAgICBcdGZ1bmN0aW9uKGNiZG9uZSl7XG4gICAgICBcdFx0c2VsZi5sb2FkQWRkcmVzcyh1c2VhZGRyLCBjYmRvbmUpO1xuICAgICAgXHR9LFxuICAgICAgICBmdW5jdGlvbihjYmRvbmUpe1xuXG5cdFx0XHRcdFx0d3JpdGVCeXRlcyA9IGhleC5zbGljZShwYWdlYWRkciwgKGhleC5sZW5ndGggPiBwYWdlU2l6ZSA/IChwYWdlYWRkciArIHBhZ2VTaXplKSA6IGhleC5sZW5ndGggLSAxKSlcbiAgICAgICAgXHRjYmRvbmUoKTtcbiAgICAgICAgfSxcbiAgICAgICAgZnVuY3Rpb24oY2Jkb25lKXtcbiAgICAgICAgXHRzZWxmLmxvYWRQYWdlKHdyaXRlQnl0ZXMsIGNiZG9uZSk7XG4gICAgICAgIH0sXG4gICAgICAgIGZ1bmN0aW9uKGNiZG9uZSl7XG5cdFx0XHRcdFx0Y29uc29sZS5sb2coXCJwcm9ncmFtbWVkIHBhZ2VcIik7XG4gICAgICAgIFx0cGFnZWFkZHIgPSAgcGFnZWFkZHIgKyB3cml0ZUJ5dGVzLmxlbmd0aDtcbiAgICAgICAgXHRzZXRUaW1lb3V0KGNiZG9uZSwgNCk7XG4gICAgICAgIH1cbiAgICAgIF0sXG4gICAgICBmdW5jdGlvbihlcnJvcikge1xuICAgICAgXHRjb25zb2xlLmxvZyhcInBhZ2UgZG9uZVwiKTtcbiAgICAgIFx0cGFnZWRvbmUoZXJyb3IpO1xuICAgICAgfSk7XG4gICAgfSxcbiAgICBmdW5jdGlvbihlcnJvcikge1xuICAgIFx0Y29uc29sZS5sb2coXCJ1cGxvYWQgZG9uZVwiKTtcbiAgICBcdGRvbmUoZXJyb3IpO1xuICAgIH1cbiAgKTtcbn07XG5cbnN0azUwMC5wcm90b3R5cGUuZXhpdFByb2dyYW1taW5nTW9kZSA9IGZ1bmN0aW9uKGRvbmUpIHtcblx0Y29uc29sZS5sb2coXCJzZW5kIGxlYXZlIHByb2dyYW1taW5nIG1vZGVcIik7XG5cdHZhciBzZWxmID0gdGhpcztcblx0dmFyIGNtZCA9IG5ldyBCdWZmZXIoW0NtbmRfU1RLX0xFQVZFX1BST0dNT0RFLCBTeW5jX0NSQ19FT1BdKTtcblx0Y29uc29sZS5sb2coY21kLnRvU3RyaW5nKCdoZXgnKSk7XG5cblx0dGhpcy5zZXJpYWxQb3J0LndyaXRlKGNtZCwgZnVuY3Rpb24oZXJyb3IsIHJlc3VsdHMpIHtcblx0XHRjb25zb2xlLmxvZyhcInNlbnQgbGVhdmUgcHJvZ3JhbW1pbmcgbW9kZVwiKTtcblx0XHRzZWxmLm1hdGNoUmVjZWl2ZShuZXcgQnVmZmVyKFtSZXNwX1NUS19JTlNZTkMsIFJlc3BfU1RLX09LXSksIHRpbWVvdXQsIGZ1bmN0aW9uKGVycm9yKXtcblx0XHRcdGRvbmUoZXJyb3IpO1xuXHRcdH0pO1xuXHR9KTtcbn07XG5cbnN0azUwMC5wcm90b3R5cGUudmVyaWZ5ID0gZnVuY3Rpb24oaGV4LCBkb25lKSB7XG5cdC8vIGNvbnNvbGUubG9nKFwidmVyaWZ5XCIpO1xuXHQvLyB2YXIgc2VsZiA9IHRoaXM7XG5cblx0Ly8gc2VyaWFsLnNlbmQoW0NtbmRfU1RLX0xPQURfQUREUkVTUywgYWRkcl9sb3csIGFkZHJfaGlnaCwgU3luY19DUkNfRU9QXSkgbiB0aW1lc1xuXHQvLyBzZWxmLm1hdGNoUmVjZWl2ZShbUmVzcF9TVEtfSU5TWU5DLCBSZXNwX1NUS19PS10pO1xuXHQvLyBzZXJpYWwuc2VuZCAoW0NtbmRfU1RLX1JFQURfUEFHRSwgYnl0ZXNfaGlnaCwgYnl0ZXNfbG93LCBtZW10eXBlLCBTeW5jX0NSQ19FT1BdKSBuIHRpbWVzXG5cdC8vIHNlbGYubWF0Y2hSZWNlaXZlKFtSZXNwX1NUS19JTlNZTkNdLmNvbmNhdCh3cml0ZUJ5dGVzKSk7XG5cdGRvbmUoKTtcbn07XG5cbi8vdG9kbyBjb252ZW5pZW5jZSBmdW5jdGlvblxuc3RrNTAwLnByb3RvdHlwZS5ib290bG9hZCA9IGZ1bmN0aW9uIChjaGlwLCBoZXgsIGRvbmUpe1xuXHRkb25lKCk7XG59O1xuXG4vLyBleHBvcnQgdGhlIGNsYXNzXG5tb2R1bGUuZXhwb3J0cyA9IHN0azUwMDtcbn0pLmNhbGwodGhpcyxyZXF1aXJlKFwiYnVmZmVyXCIpLkJ1ZmZlcikiLCJ2YXIgQnVmZmVyID0gcmVxdWlyZSgnYnVmZmVyJykuQnVmZmVyOyAvLyBmb3IgdXNlIHdpdGggYnJvd3NlcmlmeVxuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIChhLCBiKSB7XG4gICAgaWYgKCFCdWZmZXIuaXNCdWZmZXIoYSkpIHJldHVybiB1bmRlZmluZWQ7XG4gICAgaWYgKCFCdWZmZXIuaXNCdWZmZXIoYikpIHJldHVybiB1bmRlZmluZWQ7XG4gICAgaWYgKHR5cGVvZiBhLmVxdWFscyA9PT0gJ2Z1bmN0aW9uJykgcmV0dXJuIGEuZXF1YWxzKGIpO1xuICAgIGlmIChhLmxlbmd0aCAhPT0gYi5sZW5ndGgpIHJldHVybiBmYWxzZTtcbiAgICBcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGEubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgaWYgKGFbaV0gIT09IGJbaV0pIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIHRydWU7XG59O1xuIiwidmFyIFNlcmlhbFBvcnQgPSByZXF1aXJlKFwiYnJvd3Nlci1zZXJpYWxwb3J0XCIpO1xudmFyIGludGVsX2hleCA9IHJlcXVpcmUoJ2ludGVsLWhleCcpO1xudmFyIHN0azUwMCA9IHJlcXVpcmUoJ3N0azUwMCcpO1xudmFyIGFzeW5jID0gcmVxdWlyZShcImFzeW5jXCIpO1xuXG52YXIgdXNidHR5UkUgPSAvKGN1XFwudXNifHR0eUFDTXxDT01cXGQrKS87XG5cbnZhciBkYXRhID0gXCI6MTAwMDAwMDAwQzk0NjUwMDBDOTQ4RDAwMEM5NDhEMDAwQzk0OEQwMDY0XFxuOjEwMDAxMDAwMEM5NDhEMDAwQzk0OEQwMDBDOTQ4RDAwMEM5NDhEMDAyQ1xcbjoxMDAwMjAwMDBDOTQ4RDAwMEM5NDhEMDAwQzk0OEQwMDBDOTRDRDA4RDRcXG46MTAwMDMwMDAwQzk0OEQwMDBDOTQ4RDAwMEM5NDhEMDAwQzk0OEQwMDBDXFxuOjEwMDA0MDAwMEM5NEIzMTEwQzk0OEQwMDBDOTRCRDEzMEM5NDBGMTRFQ1xcbjoxMDAwNTAwMDBDOTQ4RDAwMEM5NDhEMDAwQzk0OEQwMDBDOTQ4RDAwRUNcXG46MTAwMDYwMDAwQzk0MjkwQjBDOTQ4RDAwMDAwMDAwMDAyNDAwMjcwMDQ0XFxuOjEwMDA3MDAwMkEwMDAwMDAwMDAwMjUwMDI4MDAyQjAwMDAwMDAwMDBERVxcbjoxMDAwODAwMDIzMDAyNjAwMjkwMDA0MDQwNDA0MDQwNDA0MDQwMjAyREFcXG46MTAwMDkwMDAwMjAyMDIwMjAzMDMwMzAzMDMwMzAxMDIwNDA4MTAyMDA3XFxuOjEwMDBBMDAwNDA4MDAxMDIwNDA4MTAyMDAxMDIwNDA4MTAyMDAwMDAxMlxcbjoxMDAwQjAwMDAwMDcwMDAyMDEwMDAwMDMwNDA2MDAwMDAwMDAwMDAwMjlcXG46MTAwMEMwMDAwMDAwNzQwMUM1MDk1NTBFN0UxNTExMjQxRkJFQ0ZFRjI3XFxuOjEwMDBEMDAwRDhFMERFQkZDREJGMTFFMEEwRTBCMUUwRTBFRUZERTI5MFxcbjoxMDAwRTAwMDAyQzAwNTkwMEQ5MkEwM0VCMTA3RDlGNzE0RTBBMEVFMzJcXG46MTAwMEYwMDBCMUUwMDFDMDFEOTJBNjM2QjEwN0UxRjcxMEUwQ0FFQ0VEXFxuOjEwMDEwMDAwRDBFMDA0QzAyMjk3RkUwMTBFOTRFQTE2QzIzQ0QxMDc0QlxcbjoxMDAxMTAwMEM5RjcwRTk0RDUxNTBDOTRFRTE2MEM5NDAwMDBGQjAxNTNcXG46MTAwMTIwMDBEQzAxNDE1MDUwNDA0OEYwMDE5MDBEOTIwMDIwQzlGNzg5XFxuOjEwMDEzMDAwMDFDMDFEOTI0MTUwNTA0MEUwRjcwODk1RkMwMTgxRTA1Q1xcbjoxMDAxNDAwMDkwRTAwMTkwMDYxNjA5RjRDRjAxMDAyMEQxRjcwMTk3NDVcXG46MTAwMTUwMDAwODk1RkIwMTUxOTE1NTIzQTlGMEJGMDFEQzAxNEQ5MTk4XFxuOjEwMDE2MDAwNDUxNzQxMTFFMUY3NTlGNENEMDEwMTkwMDAyMDQ5RjAwNFxcbjoxMDAxNzAwMDREOTE0MDE1NDExMUM5RjNGQjAxNDExMUVGQ0Y4MUUwRDFcXG46MTAwMTgwMDA5MEUwMDE5NzA4OTUwRjkzMUY5M0NGOTNERjkzQjgyRkJCXFxuOjEwMDE5MDAwODMzMDA4RjA3NUMwOTBFMDAxOTZBODJGQUEwRkFBMEYyRlxcbjoxMDAxQTAwMEFBMEYwMTk3QTUzMTA4RjBBNEUxNDgyRjQ0MEY0NDBGOEVcXG46MTAwMUIwMDA0NDBGNzFFMDUwRTBDNjJGRDBFMDAxRTAxMEUwMUVDMDE3XFxuOjEwMDFDMDAwODQyRjgyNTA4MjMxQzBGNDI0MkYzMEUwRjkwMUU4NTFBRFxcbjoxMDAxRDAwMEZFNEY4MDgxODIzMDgwRjQ1NzJCRjkwMUVFMEZGRjFGMTRcXG46MTAwMUUwMDBFMTUwRkU0RjExODIxMDgyODcyRjkwRTA4QzIzOUQyM0Q3XFxuOjEwMDFGMDAwODkyQjExRjAxMTgzMDA4Mzc3MEY0RjVGNEExNzAwRjNBQlxcbjoxMDAyMDAwMEJCMjM2MUY0ODUyRjhDN0ZGODk0MkJCMTk4MkY5MDk1QThcXG46MTAwMjEwMDA5MjIzODYyMzk4MkI5QkI5Nzg5NDMyQzBCMTMwMDlGNThDXFxuOjEwMDIyMDAwRjg5NDk1QjE4NTJGOEY3MzgwOTU4OTIzOTYyRjlGNzNBRVxcbjoxMDAyMzAwMDk1MjM4OTJCODVCOTQ4QjEyNTJGMzBFMDg2MkY5MEUwOTJcXG46MTAwMjQwMDAyODIzMzkyMzg2RTAzNTk1Mjc5NThBOTVFMUY3NTI5NTNEXFxuOjEwMDI1MDAwNTY5NTU2OTU1MzcwNTA5NTU0MjM1MjJCNThCOTc4OTQwRlxcbjoxMDAyNjAwMDBGQzA4NTJGOEY3MEY4OTQyOEIxOTgyRjk5MEY5OTBGOTBcXG46MTAwMjcwMDA5MDk1OTIyMzg2MjM4ODBGODgwRjk4MkI5OEI5Nzg5NEFEXFxuOjEwMDI4MDAwREY5MUNGOTExRjkxMEY5MTA4OTU0ODJGODYzMDE4RjU3N1xcbjoxMDAyOTAwMDIwOTFFMDAxMzA5MUUxMDE2NzJCODFGNDgxRTA5MEUwNTFcXG46MTAwMkEwMDAwMkMwODgwRjk5MUY0QTk1RTJGNzgwOTU5MDk1MjgyMzAwXFxuOjEwMDJCMDAwMzkyMzMwOTNFMTAxMjA5M0UwMDEwODk1ODFFMDkwRTAzQlxcbjoxMDAyQzAwMDAyQzA4ODBGOTkxRjRBOTVFMkY3MjgyQjM5MkIzMDkzRUJcXG46MTAwMkQwMDBFMTAxMjA5M0UwMDEwODk1ODMzMDI4RjRFODJGRjBFMDU1XFxuOjEwMDJFMDAwRUU1MUZFNEY2MDgzMDg5NUNGOTNERjkzQ0FFNkQyRTBDQ1xcbjoxMDAyRjAwMENFMDEwRTk0NDcwNzIzOTY4MkUwQ0UzOEQ4MDdDMUY3ODdcXG46MTAwMzAwMDBERjkxQ0Y5MTA4OTUwRjkzMUY5M0NGOTNERjkzOEIwMUNDXFxuOjEwMDMxMDAwODQzMTc4RjVDODJGRDBFMEZFMDFFODUxRkU0RkUwODEyRVxcbjoxMDAzMjAwMEUzMzA5MUYwRTQzMDI5RjU4MjUwOEMzMEUwRjQ5RTAxMDZcXG46MTAwMzMwMDAyMjUwMzA0MEM5MDE4ODBGOTkxRjgyMEY5MzFGODY1OUEwXFxuOjEwMDM0MDAwOUQ0RjBFOTRERjA3MEZDMDgzMzA1MUYwODUzMDQxRjA5MFxcbjoxMDAzNTAwMDg2MzAzMUYwODkzMDIxRjA4QTMwMTFGMDhCMzAxOUY0NzlcXG46MTAwMzYwMDBCODAxMEU5NEM5MTJDQzBGREQxRkMxNTBERTRGMTk4M0E2XFxuOjEwMDM3MDAwMDg4M0RGOTFDRjkxMUY5MTBGOTEwODk1QUY5MkJGOTJBM1xcbjoxMDAzODAwMERGOTJFRjkyRkY5MjBGOTMxRjkzREY5M0NGOTMwRjkyMjFcXG46MTAwMzkwMDBDREI3REVCN0Q4MkU3QjAxMDgyRjEwRTBGODAxRTg1MTY5XFxuOjEwMDNBMDAwRkU0RjgwODE4NjMwNjFGNDgwOTE2NzAyODgyMzQxRjA5RVxcbjoxMDAzQjAwMDY2MzA3MTA1MjlGMDEwOTI2NzAyOEZFRjgwOTNCODAxQzNcXG46MTAwM0MwMDA5RDJEOTI1MDk5ODM5QzMwQjhGNEU0RTBFRTE2RjEwNDMwXFxuOjEwMDNEMDAwOTlGMEM4MDEwMjk3NUMwMUFBMENCQjFDQTgwRUI5MUVCQlxcbjoxMDAzRTAwMDhBRTY5MkUwQTgwRUI5MUVDNTAxMEU5NENEMDc4ODIzQjdcXG46MTAwM0YwMDAxOUYwQzUwMTBFOTQ2MTA3NEQyRDRFNTA0NjMwQjhGNEVBXFxuOjEwMDQwMDAwMjA5MUUwMDEzMDkxRTEwMTkyRTBFOTE2RjEwNDA5RjA1OFxcbjoxMDA0MTAwMEUwQzA4MUUwOTBFMDA0MkUwMkMwODgwRjk5MUYwQTk0OEFcXG46MTAwNDIwMDBFMkY3MjgyQjM5MkIzMDkzRTEwMTIwOTNFMDAxRTk4MTk5XFxuOjEwMDQzMDAwRTIzMTMwRjVFRDJERTY5NUU2OTVFNjk1OTgwMTI3NzBDOVxcbjoxMDA0NDAwMDMwNzBFMTE0RjEwNDcxRjRGMEUwRTQ1MEZFNEY4MUUwMEJcXG46MTAwNDUwMDA5MEUwMDJDMDg4MEY5OTFGMkE5NUUyRjcyMDgxMjgyQjhGXFxuOjEwMDQ2MDAwMjA4MzBFQzBGMEUwRTQ1MEZFNEY4MUUwOTBFMDAyQzAzN1xcbjoxMDA0NzAwMDg4MEY5OTFGMkE5NUUyRjc4MDk1MjA4MTgyMjM4MDgzMzdcXG46MTAwNDgwMDBGODAxRUUwRkZGMUZFMTUwRkU0RjExODIxMDgyRjJFMEUzXFxuOjEwMDQ5MDAwRUYxNkYxMDRFMUYwODNFMEU4MTZGMTA0NENGNEUxMTQwNlxcbjoxMDA0QTAwMEYxMDQzOUYxOTFFMEU5MTZGMTA0MDlGMDhCQzAzMkMwOTJcXG46MTAwNEIwMDBFNEUwRUUxNkYxMDQwOUY0NURDMEY0RTBFRjE2RjEwNDk3XFxuOjEwMDRDMDAwQ0NGMTg2RTBFODE2RjEwNDA5RjA3Q0MwNzBDMDQ2MzAzQlxcbjoxMDA0RDAwMDA4RjA4Q0MwOTk4MTkyMzE0MEY0OEQyRDYwRTAwRTk0MkJcXG46MTAwNEUwMDAyOTEzOEQyRDYwRTAwRTk0NjgxMzA4NTExRTRGODJFMDkxXFxuOjEwMDRGMDAwNjZDMEY5ODFGMjMxMDhGMDc5QzA4RDJENjBFMDBFOTQ2Q1xcbjoxMDA1MDAwMDI5MTM4RDJENjBFMDBFOTQ2ODEzMDg1MTFFNEZGODAxRDlcXG46MTAwNTEwMDAxMDgyNkNDMEY5ODFGMjMxMDhGMDY4QzA4RDJENjBFMDY2XFxuOjEwMDUyMDAwMEU5NDY4MTM4RDJENjFFMDBFOTQyOTEzMDg1MTFFNEYwRlxcbjoxMDA1MzAwMDgxRTA0NUMwRjNFMERGMTY4MUYwODVFMEQ4MTY2OUYwNzBcXG46MTAwNTQwMDA5NkUwRDkxNjUxRjBFOUUwREUxNjM5RjBGQUUwREYxNjUwXFxuOjEwMDU1MDAwMjFGMDhCRTBEODE2MDlGMDQ5QzA4RDJENjFFMDBFOTQ5MlxcbjoxMDA1NjAwMDI5MTM4RDJENjBFMDcwRTAwRTk0QzkxMjA4NTExRTRGQzJcXG46MTAwNTcwMDA4M0UwMjVDMEY5ODFGQzMwQzhGNUY4MDFFODUxRkU0RjUxXFxuOjEwMDU4MDAwODRFMDgwODNDODAxMDI5NzdDMDFFRTBDRkYxQ0U4MEUxQVxcbjoxMDA1OTAwMEY5MUU4QUU2OTJFMEU4MEVGOTFFQzcwMTBFOTRDRDA3MTdcXG46MTAwNUEwMDA4ODIzMjFGNUM3MDFCODAxMEU5NEM2MDgxRkMwOUVFRTJFXFxuOjEwMDVCMDAwRDkwRUUxRTBFRDE1RDBGMDA4NTExRTRGODZFMEY4MDFBQ1xcbjoxMDA1QzAwMDgwODMxNEMwODRFNzkzRTA2MEUwNzFFMDBFOTRFMDBFNTVcXG46MTAwNUQwMDAwREMwODFFMDkwRTAwNDJFMDJDMDg4MEY5OTFGMEE5NDlDXFxuOjEwMDVFMDAwRTJGNzgwOTU5MDk1MjgyMzM5MjMxRENGMEY5MENGOTE2NlxcbjoxMDA1RjAwMERGOTExRjkxMEY5MUZGOTBFRjkwREY5MEJGOTBBRjkwMzBcXG46MTAwNjAwMDAwODk1MUY5MzgwOTE2NzAyODgyMzI5RjAxMDkyNjcwMjUyXFxuOjEwMDYxMDAwOEZFRjgwOTNCODAxMTA5MkUyMDExMDkyRkMwMTEwOTJDQVxcbjoxMDA2MjAwMEU1MDExMDkyRTMwMTEwOTJGRDAxMTA5MkU2MDExMDkyOTNcXG46MTAwNjMwMDBFNDAxMTA5MkZFMDExMDkyRTcwMTEwRTA4MTJGOEU1MDJDXFxuOjEwMDY0MDAwODYzMDIwRjQ4MTJGNjJFMDcwRTAwM0MwODEyRjYxRTBFQVxcbjoxMDA2NTAwMDcwRTAwRTk0QkUwMTFGNUYxNDMxODFGNzEwOTJFMTAxMkFcXG46MTAwNjYwMDAxMDkyRTAwMTFGOTEwODk1MEY5MzFGOTMwNEU3MTNFMDg4XFxuOjEwMDY3MDAwQzgwMTYxRTE3MUUwNDJFMDIzRTAwRTk0REIwRkM4MDFBNFxcbjoxMDA2ODAwMDYwRUU0M0U4NTFFMDBFOTQwRjBFQzgwMTYwRTk0M0VDQzBcXG46MTAwNjkwMDA1MEUwMEU5NDBGMEVDODAxNjBFQzQ1RTQ1MUUwMEU5NDVBXFxuOjEwMDZBMDAwMEYwRUM4MDE2MEVENENFNjUxRTAwRTk0MEYwRUM4MDEyQ1xcbjoxMDA2QjAwMDY0RUY0RUVCNTFFMDBFOTQwRjBFQzgwMTYwRUY0Q0VENkRcXG46MTAwNkMwMDA1NEUwMEU5NDMzMEVDODAxNkZFRjQxRTA1M0UwMEU5NEY2XFxuOjEwMDZEMDAwMkQwRUM4MDE0MEUwNTFFRTYwRTA3MEUwMEU5NDRBMTAyQlxcbjoxMDA2RTAwMDBFOTQwMTAzMUY5MTBGOTEwODk1MUY5MzEwRTA4MTJGMjVcXG46MTAwNkYwMDA4MjUxODIzMDI4RjQ4MTJGNjZFMDcwRTAwRTk0QkUwMUIyXFxuOjEwMDcwMDAwMUY1RjE0MzFBMUY3ODFFMDgwOTM2NzAyOEFFRjkyRTBDNlxcbjoxMDA3MTAwMDBFOTQ2NTBBMUY5MTA4OTUxRjkzQ0Y5M0RGOTMyODJGOUVcXG46MTAwNzIwMDAxNjJGQzgyRkQwRTBGRTAxRTQ1MEZFNEY4MDgxMTgyMzIxXFxuOjEwMDczMDAwNDQyMzMxRjRGRTAxRUI1MUZFNEY4MDgxODExNzUxRjBDQlxcbjoxMDA3NDAwMDg0RTc5M0UwNjIyRjQxMkY1MEUwMEU5NEFBMERDQjUxMjVcXG46MTAwNzUwMDBERTRGMTg4M0RGOTFDRjkxMUY5MTA4OTU4MDkxRTIwMUMwXFxuOjEwMDc2MDAwODgyMzQ5RjA2OUIxODA5MUZDMDE2ODIzNkM3RjgwRTBBN1xcbjoxMDA3NzAwMDQwRTAwRTk0OEMwMzgwOTFFMzAxODgyMzc5RjA4M0IxRUJcXG46MTAwNzgwMDA2NkIxNjI5NTY2MEY2NjBGNjA3QzhGNzM2ODJCODA5MUVGXFxuOjEwMDc5MDAwRkQwMTY4MjM4MUUwNDBFMDBFOTQ4QzAzODA5MUU0MDEyOFxcbjoxMDA3QTAwMDg4MjM3OUYwODZCMTkwRTA4QzczOTA3MDk1OTU4Nzk1NDlcXG46MTAwN0IwMDA5NTk1ODc5NTYwOTFGRTAxNjgyMzgyRTA0MEUwMEU5NDU0XFxuOjEwMDdDMDAwOEMwMzA4OTVFRjkyRkY5MjBGOTMxRjkzQ0Y5M0RGOTNDM1xcbjoxMDA3RDAwMEY4MkVFQjAxRTQyRThGRUY2RjNGNzgwNzE5RjRDMEUwOURcXG46MTAwN0UwMDBEMEUwMTRDMDhBRUY5MkUwNkYyRDBFOTQ4QjA5OEFFRjRGXFxuOjEwMDdGMDAwOTJFMDZDMkYwRTk0MEQwQThBRUY5MkUwMEU5NDUwMEE0Q1xcbjoxMDA4MDAwMDgwOTE2ODAyOTA5MTY5MDIwRTk0NjIxMjhBRUY5MkUwRTBcXG46MTAwODEwMDA2RjJENEUyRDBFOTQ2MTBBMEUyRDEwRTA4QUVGOTJFMDlFXFxuOjEwMDgyMDAwMEU5NDk1MDkwODE3MTkwNzkxRjRGMDkyNDcwMkMwOTNBNlxcbjoxMDA4MzAwMDQ4MDJDOUU0RDJFMDBDMEYxRDFGMDVDMDhBRUY5MkUwMDhcXG46MTAwODQwMDAwRTk0OUUwOTg5OTNDMDE3RDEwN0MxRjcxMkMwOEFFRjkxXFxuOjEwMDg1MDAwOTJFMDBFOTQ5NTA5ODAxNzkxMDcyQ0Y0ODRFNzkzRTBCOVxcbjoxMDA4NjAwMDY1RTI3MUUwMDRDMDg0RTc5M0UwNkRFNDcxRTAwRTk0MEFcXG46MTAwODcwMDBFMDBFODJFMEU4MEU4NEU3OTNFMDY3RTc0RTJEMjdFNDgwXFxuOjEwMDg4MDAwMzJFMDBFOTREQzBEREY5MUNGOTExRjkxMEY5MUZGOTAxQ1xcbjoxMDA4OTAwMEVGOTAwODk1QUY5MkJGOTJDRjkyREY5MkVGOTJGRjkyQzZcXG46MTAwOEEwMDAwRjkzMUY5M0NGOTNERjkzMEU5NEFFMDMwNEMwODRFNzlFXFxuOjEwMDhCMDAwOTNFMDBFOTQyQzBGODRFNzkzRTAwRTk0ODMwRDg5MkIyNFxcbjoxMDA4QzAwMEIxRjcwRTk0RkIxMTYwOTMyNzAyNzA5MzI4MDI4MDkzNzZcXG46MTAwOEQwMDAyOTAyOTA5MzJBMDJBMDkwMkIwMkIwOTAyQzAyQzA5MDgzXFxuOjEwMDhFMDAwMkQwMkQwOTAyRTAyMjA5MUI2MDEzMDkxQjcwMTc5MDFFRVxcbjoxMDA4RjAwMDAwMjdGN0ZDMDA5NTEwMkY2QTE5N0IwOThDMDk5RDA5QzhcXG46MTAwOTAwMDBFNjE2RjcwNjA4MDcxOTA3MDhGMDRCQzBFQTBDRkIxQ0FGXFxuOjEwMDkxMDAwMEMxRDFEMURFMDkyMkIwMkYwOTIyQzAyMDA5MzJEMDI2M1xcbjoxMDA5MjAwMDEwOTMyRTAyQzhFRUQxRTAxMkVGMTYzMEMwRjQ4ODgxODlcXG46MTAwOTMwMDA4MjMwQTlGNDgwOTFFMDAxOTA5MUUxMDEwMTJFMDJDMDgyXFxuOjEwMDk0MDAwOTU5NTg3OTUwQTk0RTJGNzgwRkYwOUMwODEyRjBFOTQ1MFxcbjoxMDA5NTAwMEE3MTJBQzAxODRFNzkzRTA2MTJGMEU5NDhGMEQxRjVGMDdcXG46MTAwOTYwMDAyMTk2MTYzMDExRjc4MDkxQjgwMTg3RkQxQUMwMTBFMDZBXFxuOjEwMDk3MDAwMEVDMEY5MDFFRTBGRkYxRkUyMEZGMzFGRTE1REZENEYwN1xcbjoxMDA5ODAwMDYxODE4MDgxNzBFMDQyODEwRTk0RTIwMzFGNUYyMTJGMUNcXG46MTAwOTkwMDAzMEUwODA5MUI4MDE5OTI3ODdGRDkwOTU4MjE3OTMwN0UxXFxuOjEwMDlBMDAwNDRGN0RGOTFDRjkxMUY5MTBGOTFGRjkwRUY5MERGOTA2RlxcbjoxMDA5QjAwMENGOTBCRjkwQUY5MDA4OTVCRjkyQ0Y5MkRGOTJFRjkyMDlcXG46MTAwOUMwMDBGRjkyMEY5MzFGOTNDRjkzREY5MzE2MkZFQTAxOEYzNjc5XFxuOjEwMDlEMDAwMDlGNDRGQzE4MDM3NTBGNDhCMzYwOUY0NkFDMThEMzY2M1xcbjoxMDA5RTAwMDA5RjREM0MxODkzNjA5RjA0OEMyMjhDMjg2Mzc2OUYwQjRcXG46MTAwOUYwMDA4NzM3MjBGNDgwMzcwOUYwNDBDMkU0QzA4ODM3MDlGNDEzXFxuOjEwMEEwMDAwQzdDMDhBMzcwOUYwMzlDMjE5QzE4OTgxODVGRjA1QzA3RFxcbjoxMDBBMTAwMDg0RTc5M0UwNjRFNzcxRTA1NEMwNjg4MTg4NzE4ODMwQUVcXG46MTAwQTIwMDA1OUYxODkzMDE4RjQ4ODIzNDFGMDI3QzI4MDMxMDlGNDQ0XFxuOjEwMEEzMDAwNDBDMDg4MzEwOUYwMjFDMjY0QzA4QUVGOTJFMDBFOTQ3MFxcbjoxMDBBNDAwMDhCMDkwMkUwMEVDMEZFMDFFMDBGRjExRDYxODE2Nzk1ODhcXG46MTAwQTUwMDA2NjI3Njc5NTgwODE2ODBGOEFFRjkyRTAwRTk0MEQwQUYxXFxuOjEwMEE2MDAwMEU1RjAxMTc4MEYzOEFFRjkyRTAwRTk0NTAwQTg2RTQzRFxcbjoxMDBBNzAwMDkwRTAwRTk0NjIxMjAxQzI5QjgxOEE4MTE2MzA3MUY0NUJcXG46MTAwQTgwMDA5Nzk1OTkyNzk3OTU5ODBGNEQ4MTQ3OTU0NDI3NDc5NUI2XFxuOjEwMEE5MDAwOEM4MTQ4MEY4NjJGNjkyRjcwRTAwOEMwOTc5NTk5MjdBMVxcbjoxMDBBQTAwMDk3OTU5ODBGODYyRjZGRUY3RkVGNDkyRjBFOTRFMjAzRjNcXG46MTAwQUIwMDBFNEMxODA5MUI4MDE4NzMwM0NGMDg0RTc5M0UwNjBFQUJDXFxuOjEwMEFDMDAwNzFFMDBFOTRFMDBFRDlDMThGNUY4MDkzQjgwMTk5MjczMVxcbjoxMDBBRDAwMDg3RkQ5MDk1RkMwMUVFMEZGRjFGRTgwRkY5MUZFMTVEMDhcXG46MTAwQUUwMDBGRDRGNjA4MzhCODE4Nzk1ODgyNzg3OTU5QTgxODkwRjMxXFxuOjEwMEFGMDAwODE4MzhEODE4Nzk1ODgyNzg3OTU5QzgxODkwRjgyODM0M1xcbjoxMDBCMDAwMEJDQzE1MDkxQjgwMTE1MTYzNEY0MjBFMEM1MkZERDI3ODNcXG46MTAwQjEwMDBDN0ZERDA5NTExQzA4RkVGODA5M0I4MDFBRUMxRkMwMTI1XFxuOjEwMEIyMDAwRUUwRkZGMUZFODBGRjkxRkUxNURGRDRGNjA4MzY2MjNBNVxcbjoxMDBCMzAwMDExRjA0MjJGMjRDMDJGNUY4MjJGOTBFMEM4MTdEOTA3RjFcXG46MTAwQjQwMDA3NEY3NDBFMDFDQzA0ODMwQzhGNEM5MDEwMTk2RDkwMUNGXFxuOjEwMEI1MDAwQUEwRkJCMUZBMjBGQjMxRkExNURCRDRGRkMwMUVFMEY3QlxcbjoxMDBCNjAwMEZGMUZFODBGRjkxRkUxNURGRDRGODA4MThDOTM4MDgxQURcXG46MTAwQjcwMDAxMTk2OEM5MzExOTc4MjgxMTI5NjhDOTM0RjVGMjQyRjNDXFxuOjEwMEI4MDAwMzBFMEMyMTdEMzA3RkNGNjUxNTA1MDkzQjgwMTc1QzEzRFxcbjoxMDBCOTAwMDg5ODE2ODJGNzBFMDc2OTU3NjJGNjYyNzc3OTU2Nzk1MUZcXG46MTAwQkEwMDA4ODgxNjgwRjcxMUQ2MTE1NzEwNTIxRjA3MDkzNjkwMkNDXFxuOjEwMEJCMDAwNjA5MzY4MDI4MDkxNjcwMjg4MjMwOUYwNUVDMTBFOTRGOVxcbjoxMDBCQzAwMDc1MDM1QkMxNjUzMDA4RjQ1OEMxRjg4MEM5ODBFQTgwQkNcXG46MTAwQkQwMDBCQjgwREM4MDhGMkQ4MjUwOEMzMDA4RjA0RUMxMEYyREYxXFxuOjEwMEJFMDAwMTBFMEM4MDEwMjk3RUMwMUNDMEZERDFGQzgwRkQ5MUYyMFxcbjoxMDBCRjAwMEM2NTlERDRGQ0UwMTBFOTRDRDA3ODgyMzE5RjBDRTAxRTJcXG46MTAwQzAwMDAwRTk0NjEwNzRFMkQ1MEUwNTY5NTU0MkY0NDI3NTc5NTZBXFxuOjEwMEMxMDAwNDc5NTRDMEQ1MTFEMkQyRDMwRTAzNjk1MzIyRjIyMjc1MlxcbjoxMDBDMjAwMDM3OTUyNzk1MkIwRDMxMURDRTAxQjgwMTBFOTQ0NzA4M0RcXG46MTAwQzMwMDA4RjJENjRFMDcwRTAwRTk0QkUwMTFGQzE2MjMwMDhGNDk1XFxuOjEwMEM0MDAwMUNDMTg5ODE5MEUwOTY5NTk4MkY4ODI3OTc5NTg3OTU2NFxcbjoxMDBDNTAwMDI4ODE4MjBGOTExRDkwOTNCNzAxODA5M0I2MDEwQTk3NjZcXG46MTAwQzYwMDAwQ0YwMEJDMThBRTA5MEUwOTA5M0I3MDE4MDkzQjYwMTNEXFxuOjEwMEM3MDAwMDRDMTYyMzAwOEY0MDFDMTg5ODE2ODJGNzBFMDEyMzAyQ1xcbjoxMDBDODAwMEExRjA4QTgxOTBFMDk2OTU5ODJGODgyNzk3OTU4Nzk1NkZcXG46MTAwQzkwMDA2ODJCNzkyQjEzMzA0OUYwMkI4MTkyMkY5Mjk1OTkwRjY1XFxuOjEwMENBMDAwOTkwRjkwN0M4MEUwNjgyQjc5MkI4ODgxMEU5NDgzMDFDQVxcbjoxMDBDQjAwMEU0QzA4MEU0OTRFMDYwRUYwRTk0M0UxNTgwRTQ5NEUwOUNcXG46MTAwQ0MwMDA2Q0U2MEU5NDNFMTUwMEUwMUVFRjE2QzAxMjMxQTBGNDQzXFxuOjEwMENEMDAwODBFNDk0RTA2MEUwMEU5NDNFMTU4MEU0OTRFMDYxRTBFRVxcbjoxMDBDRTAwMDBFOTQzRTE1ODBFNDk0RTA2MUUwMEU5NDNFMTU4MEU0OURcXG46MTAwQ0YwMDA5NEUwNjFFMDBFOTQzRTE1ODAyRjhFNTA4NjMwNTBGNEMzXFxuOjEwMEQwMDAwODBFNDk0RTA2MkUwMEU5NDNFMTU4MEU0OTRFMDZBRTBCMlxcbjoxMDBEMTAwMDBFOTQzRTE1MDMzMDUxRjAwNTMwNDFGMDA2MzAzMUYwQURcXG46MTAwRDIwMDAwOTMwMjFGMDBBMzAxMUYwMEIzMDUxRjQ4MEU0OTRFMEU2XFxuOjEwMEQzMDAwNjNFMDBFOTQzRTE1ODBFNDk0RTA2OEUwMEU5NDNFMTU2NlxcbjoxMDBENDAwMDFDMzA1MEY0ODBFNDk0RTA2NEUwMEU5NDNFMTU4MEU0OUVcXG46MTAwRDUwMDA5NEUwNkVFMDBFOTQzRTE1ODAyRjgyNTE4MjMwNTBGNDY0XFxuOjEwMEQ2MDAwODBFNDk0RTA2NkUwMEU5NDNFMTU4MEU0OTRFMDYxRTA1N1xcbjoxMDBENzAwMDBFOTQzRTE1ODBFNDk0RTA2RkU3MEU5NDNFMTUwRjVGRURcXG46MTAwRDgwMDAxRjVGMDQzMTA5RjBBMkNGNzNDMDY2MjMwOUY0NzVDMDU4XFxuOjEwMEQ5MDAwMDg4MTgwRTQ5NEUwNjBFRjBFOTQzRTE1ODBFNDk0RTBENlxcbjoxMDBEQTAwMDZFRTYwRTk0M0UxNTgwRTQ5NEUwNjAyRjBFOTQzRTE1OUVcXG46MTAwREIwMDAwNDMxMDhGMDVEQzBDMDJGRDBFMEZFMDFFODUxRkU0RkM1XFxuOjEwMERDMDAwODBFNDk0RTA2MDgxMEU5NDNFMTU4RTAxMDAwRjExMUZBN1xcbjoxMDBERDAwMDAxNTAxRTRGRjgwMTYwODE3MEUwNkY3NzcwNzA4MEU0MDFcXG46MTAwREUwMDA5NEUwMEU5NDNFMTVGODAxNjA4MTcxODFDQjAxODA3ODBBXFxuOjEwMERGMDAwODkyQjU5RjA2NjBGNjcyRjY2MUY3NzBCNzBFMDZGNzdBRVxcbjoxMDBFMDAwMDcwNzA4MEU0OTRFMDBFOTQzRTE1Q0MwRkREMUZDMTUwNERcXG46MTAwRTEwMDBERTRGMjg4MTM5ODFDOTAxODA3MDkwN0M4OTJCNDFGMTk2XFxuOjEwMEUyMDAwMzMwRjIyMEIzMzBGMzIyRjIyMUY2MjJGNzBFMDZGNzdBOFxcbjoxMDBFMzAwMDcwNzA4MEU0OTRFMDBFOTQzRTE1MUFDMDgwRTQ5NEUwNTNcXG46MTAwRTQwMDA2MEVGMEU5NDNFMTU4MEU0OTRFMDZBRTYwRTk0M0UxNTQxXFxuOjEwMEU1MDAwQzJFRkRGRUZDNjMwMThGMDZGRTc3MEUwMDFDMEJFMDFFRlxcbjoxMDBFNjAwMDgwRTQ5NEUwMEU5NDNFMTUyMTk2QzYzMEQxMDU5MUY3QUFcXG46MTAwRTcwMDA4MEU0OTRFMDY3RUYwRTk0M0UxNURGOTFDRjkxMUY5MUNGXFxuOjEwMEU4MDAwMEY5MUZGOTBFRjkwREY5MENGOTBCRjkwMDg5NUZDMDFGRFxcbjoxMDBFOTAwMDgwOTE4RTAyOEMzMDkwRjQ4MDgzOEY1RjgwOTM4RTAyRERcXG46MTAwRUEwMDA4MTUwOTBFMEZDMDFFRTBGRkYxRkU4MEZGOTFGRTE1N0EyXFxuOjEwMEVCMDAwRkQ0Rjg4RUI5QkUwOTI4MzgxODMwODk1OEZFRjgwODNDMVxcbjoxMDBFQzAwMDA4OTVEQzAxOEM5MTkwRTBGQzAxRUUwRkZGMUZFODBGMENcXG46MTAwRUQwMDBGOTFGRTE1N0ZENEY4MDgxOEY3QjgwODM4QzkxNkNFMEZGXFxuOjEwMEVFMDAwMEU5NDc4MTY5MEUwQUMwMTQ0MEY1NTFGNDgwRjU5MUYxRlxcbjoxMDBFRjAwMDQ0MEY1NTFGNDQwRjU1MUYyMEUwMzBFMEM5MDE4NDBGRjdcXG46MTAwRjAwMDA5NTFGRkMwMUVFMEZGRjFGRTgwRkY5MUZFMTU3RkQ0RjgyXFxuOjEwMEYxMDAwODA4MTg2RkQwNUMwMkY1RjNGNEYyQzMwMzEwNTcxRjc3MlxcbjoxMDBGMjAwMDA4OTVGQzAxMjA4MTJDMzBCOEY1ODE4MTk5Mjc4N0ZEMzdcXG46MTAwRjMwMDA5MDk1NDhFODUwRTA0ODFCNTkwQjQ0MEY1NTFGNDQwRjRCXFxuOjEwMEY0MDAwNTUxRjY0MTc3NTA3ODRGMDgyODE5OTI3ODdGRDkwOTU1NlxcbjoxMDBGNTAwMDQ4RTU1MkUwNDgxQjU5MEI0NDBGNTUxRjQ0MEY1NTFGRERcXG46MTAwRjYwMDA2NDE3NzUwNzBDRjRBQjAxNDI1MDUwNDBDQTAxQUEyNzIwXFxuOjEwMEY3MDAwOTdGREEwOTVCQTJGODgwRjk5MUZBQTFGQkIxRjRGQjdDN1xcbjoxMDBGODAwMEY4OTQzMEUwRjkwMUVFMEZGRjFGRTIwRkYzMUZFMTU3NzVcXG46MTAwRjkwMDBGRDRGOTI4MzgxODM0RkJGMDg5NUZDMDE4MDgxOTBFMEQzXFxuOjEwMEZBMDAwRkMwMUVFMEZGRjFGRTgwRkY5MUZFMTU3RkQ0RjgwODE5NVxcbjoxMDBGQjAwMDgyOTU4Njk1ODY5NTgxNzAwOUYwODFFMDA4OTVBRjkyQkJcXG46MTAwRkMwMDBCRjkyQ0Y5MkRGOTJFRjkyRkY5MjBGOTMxRjkzQ0Y5MzM2XFxuOjEwMEZEMDAwREY5M0VDMDE5QjAxODJFMDYwMzI3ODA3MENGMDQ4QzA5RlxcbjoxMDBGRTAwMDc3RkYwM0MwMjBFMDMwRTAwNUMwNjUzQjcxMDUxNEYwRDlcXG46MTAwRkYwMDAyNEVCMzBFMDAwRDAwMEQwQjkwMTg4Mjc3N0ZEODA5NTQwXFxuOjEwMTAwMDAwOTgyRjI5ODEzMzI3MjdGRDMwOTVFOEU4QUUyRUIxMkNBM1xcbjoxMDEwMTAwMEEyMUFCMzBBQUEwQ0JCMUNBQTBDQkIxQ0NDMjRCN0ZDOUFcXG46MTAxMDIwMDBDMDk0REMyQ0VBODFGRjI3RTdGREYwOTUyOEU1MzJFMDRCXFxuOjEwMTAzMDAwMkUxQjNGMEIyMjBGMzMxRjIyMEYzMzFGNDQyNzM3RkQ3OFxcbjoxMDEwNDAwMDQwOTU1NDJGRURCN0ZFQjcyMTgzMzI4MzQzODM1NDgzRjlcXG46MTAxMDUwMDAyMEUwMzBFMDQwRTA1MEUwMDRFQkUwMkVGMTJDMDEyREU4XFxuOjEwMTA2MDAwMTEyRDBFOTQxMDE2OUIwMTBGOTAwRjkwMEY5MDBGOTA2MlxcbjoxMDEwNzAwMENFMDFCOTAxMEU5NDkxMDdERjkxQ0Y5MTFGOTEwRjkxOERcXG46MTAxMDgwMDBGRjkwRUY5MERGOTBDRjkwQkY5MEFGOTAwODk1Q0Y5MkY4XFxuOjEwMTA5MDAwREY5MkVGOTJGRjkyMUY5M0NGOTNERjkzRUMwMTE2MkYxNVxcbjoxMDEwQTAwMDdBMDE2OTAxODg4MThDMzAwOEYwNjRDMDg2MkY2MUUwODRcXG46MTAxMEIwMDAwRTk0MjkxMzg4ODE5MEUwRkMwMUVFMEZGRjFGRTgwRkNBXFxuOjEwMTBDMDAwRjkxRkUxNTdGRDRGMUY3MzgwODE4MDdDODEyQjgwODM0NlxcbjoxMDEwRDAwMDgwRTI5MkUwOEUxOTlGMDk2NEUwNzBFMDBFOTQ4NDE2MURcXG46MTAxMEUwMDA2OTgzODBFNjk5RTA4QzE5OUQwOTY0RTA3MEUwMEU5NEI0XFxuOjEwMTBGMDAwODQxNjZBODNBODgxOEEyRjZDRTAwRTk0NzgxNjY4MkY3NFxcbjoxMDExMDAwMDcwRTBBQjAxNDQwRjU1MUY0NjBGNTcxRjQ0MEY1NTFGOEFcXG46MTAxMTEwMDA0NDBGNTUxRjIwRTAzMEUwQzkwMTg0MEY5NTFGRkMwMUVBXFxuOjEwMTEyMDAwRUUwRkZGMUZFODBGRjkxRkUxNTdGRDRGODA4MTg2RkQ4RFxcbjoxMDExMzAwMDE1QzAyRjVGM0Y0RjJDMzAzMTA1NzFGNzI0QzAxMDkyM0VcXG46MTAxMTQwMDA4MDAwODJFMDgwOTM4MTAwMTA5Mjg1MDAxMDkyODQwMERDXFxuOjEwMTE1MDAwQjE5QTgwOTE2RjAwODI2MDgwOTM2RjAwOEEyRjkwRTAzN1xcbjoxMDExNjAwMEZDMDFFRTBGRkYxRkU4MEZGOTFGRTE1N0ZENEY4MDgxRDNcXG46MTAxMTcwMDA4MDY0ODA4Mzg4ODFERjkxQ0Y5MTFGOTFGRjkwRUY5MEYxXFxuOjEwMTE4MDAwREY5MENGOTAwODk1NjcyQkQxRjJFOENGNDBFMjUyRTA5NFxcbjoxMDExOTAwMDIwRTYzOUUwMEU5NDQ3MDgwODk1MUY5MjBGOTIwRkI2OEJcXG46MTAxMUEwMDAwRjkyMTEyNDJGOTMzRjkzNEY5MzVGOTM2RjkzN0Y5M0VEXFxuOjEwMTFCMDAwOEY5MzlGOTNBRjkzQkY5M0VGOTNGRjkzODA5MUIzMDI2RFxcbjoxMDExQzAwMDg3RkYwNUMwMTA5Mjg1MDAxMDkyODQwMDJCQzAyMDkxRUJcXG46MTAxMUQwMDBCMzAyMzMyNzI3RkQzMDk1ODA5MThFMDI5MEUwMjgxN0M3XFxuOjEwMTFFMDAwMzkwNzA0RjU4MDkxQjMwMjk5Mjc4N0ZEOTA5NUZDMDE5QVxcbjoxMDExRjAwMEVFMEZGRjFGRTgwRkY5MUZFMTU3RkQ0RjgwODE4NkZGQkJcXG46MTAxMjAwMDAxMUMwODA5MUIzMDI5OTI3ODdGRDkwOTVGQzAxRUUwRkU0XFxuOjEwMTIxMDAwRkYxRkU4MEZGOTFGRTE1N0ZENEY4MDgxOEY3MzYwRTBEQVxcbjoxMDEyMjAwMDBFOTQ2ODEzODA5MUIzMDI4RjVGODA5M0IzMDIyMDkxNzRcXG46MTAxMjMwMDBCMzAyMzMyNzI3RkQzMDk1ODA5MThFMDI5MEUwMjgxNzY2XFxuOjEwMTI0MDAwMzkwNzBDRjA0RUMwODA5MUIzMDI4QzMwMENGMDQ5QzBDRFxcbjoxMDEyNTAwMDIwOTE4NDAwMzA5MTg1MDA4MDkxQjMwMjk5Mjc4N0ZEMDlcXG46MTAxMjYwMDA5MDk1RkMwMUVFMEZGRjFGRTgwRkY5MUZFMTU3RkQ0RkFFXFxuOjEwMTI3MDAwODE4MTkyODEyODBGMzkxRjMwOTM4OTAwMjA5Mzg4MDA0M1xcbjoxMDEyODAwMDgwOTFCMzAyOTkyNzg3RkQ5MDk1RkMwMUVFMEZGRjFGMTdcXG46MTAxMjkwMDBFODBGRjkxRkUxNTdGRDRGODA4MTg2RkYyQkMwODA5MTM5XFxuOjEwMTJBMDAwQjMwMjk5Mjc4N0ZEOTA5NUZDMDFFRTBGRkYxRkU4MEYxMVxcbjoxMDEyQjAwMEY5MUZFMTU3RkQ0RjgwODE4RjczNjFFMDBFOTQ2ODEzMzFcXG46MTAxMkMwMDAxOUMwODBFNDlDRTkwNUMwODA5MTg0MDA5MDkxODUwMDVDXFxuOjEwMTJEMDAwMDQ5NjkwOTM4OTAwODA5Mzg4MDA4RkVGODA5M0IzMDJFN1xcbjoxMDEyRTAwMDA5QzA4MDkxODQwMDkwOTE4NTAwMDQ5NjgwNTQ5QzQ5QTdcXG46MTAxMkYwMDA0MEYzRUFDRkZGOTFFRjkxQkY5MUFGOTE5RjkxOEY5MTEyXFxuOjEwMTMwMDAwN0Y5MTZGOTE1RjkxNEY5MTNGOTEyRjkxMEY5MDBGQkUwMVxcbjoxMDEzMTAwMDBGOTAxRjkwMTg5NTgxRTA4MDkzRjkwMjYwOTNENjAyOThcXG46MTAxMzIwMDAxMDkyRjcwMjEwOTJGODAyMDg5NTIwOTFENTAyMzBFMDUxXFxuOjEwMTMzMDAwODA5MUQ0MDIyODFCMzEwOUM5MDEwODk1NDA5MUQ0MDIzQlxcbjoxMDEzNDAwMDgwOTFENTAyNDgxNzE4RjAyRkVGM0ZFRjBBQzBFNDJGMjVcXG46MTAxMzUwMDBGMEUwRUM1NEZENEY4MDgxMjgyRjMwRTA0RjVGNDA5MzQ4XFxuOjEwMTM2MDAwRDQwMkM5MDEwODk1RTA5MUQ0MDI4MDkxRDUwMkU4MTcxMlxcbjoxMDEzNzAwMDE4RjBFRkVGRkZFRjA2QzBGMEUwRUM1NEZENEY4MDgxNzZcXG46MTAxMzgwMDBFODJGRjBFMENGMDEwODk1MDg5NTEwOTJGRDAyMTA5MjI5XFxuOjEwMTM5MDAwRkMwMjg4RUU5M0UwQTBFMEIwRTA4MDkzRkUwMjkwOTMyMFxcbjoxMDEzQTAwMEZGMDJBMDkzMDAwM0IwOTMwMTAzODRFQzkxRTA5MDkzQkJcXG46MTAxM0IwMDBGQjAyODA5M0ZBMDIwODk1Q0Y5MkRGOTJFRjkyRkY5MkEwXFxuOjEwMTNDMDAwMEY5MzFGOTNDRjkzREY5MzdDMDE2QjAxOEEwMTgwOTE3MFxcbjoxMDEzRDAwMEY5MDI4ODIzQTFGMEMwRTBEMEUwMERDMEQ3MDFFRDkxNjNcXG46MTAxM0UwMDBGQzkxRDYwMUFDMEZCRDFGMDE5MEYwODFFMDJEQzcwMTJCXFxuOjEwMTNGMDAwNkM5MTA5OTUyMTk2QzAxN0QxMDc4MEYzMDRDMENCMDFFOVxcbjoxMDE0MDAwMDY0MkYwRTk0MEUwQkM4MDFERjkxQ0Y5MTFGOTEwRjkxQTVcXG46MTAxNDEwMDBGRjkwRUY5MERGOTBDRjkwMDg5NURGOTNDRjkzMEY5MkRFXFxuOjEwMTQyMDAwQ0RCN0RFQjdGQzAxNjk4MzgwOTFGOTAyODgyM0M5RjA0QVxcbjoxMDE0MzAwMDgwOTFGODAyODAzMjM4RjA4MUUwOTBFMDkzODM4MjgzREJcXG46MTAxNDQwMDAyMEUwMzBFMDE1QzA4MDkxRjcwMkU4MkZGMEUwRTk1MjhCXFxuOjEwMTQ1MDAwRkQ0Rjk5ODE5MDgzOEY1RjgwOTNGNzAyODA5M0Y4MDIwQ1xcbjoxMDE0NjAwMDA1QzBDRTAxMDE5NjYxRTAwRTk0MEUwQjIxRTAzMEUwNDRcXG46MTAxNDcwMDBDOTAxMEY5MENGOTFERjkxMDg5NTBGOTMwNjJGODA5MUFFXFxuOjEwMTQ4MDAwRDYwMjY3RUQ3MkUwNDA5MUY4MDIyMUUwMEU5NEI5MEFBRFxcbjoxMDE0OTAwMDEwOTJGNzAyMTA5MkY4MDIxMDkyRjkwMjBGOTEwODk1M0JcXG46MTAxNEEwMDA2MUUwMEU5NDNEMEEwODk1NDEzMjA4RjA0MEUyODYyRjMzXFxuOjEwMTRCMDAwNjRFQjcyRTAwRTk0NzAwQTEwOTJENDAyODA5M0Q1MDIwRFxcbjoxMDE0QzAwMDA4OTUyMUUwMEU5NDU0MEEwODk1MTA5MkQ0MDIxMDkyQzdcXG46MTAxNEQwMDBENTAyMTA5MkY3MDIxMDkyRjgwMjBFOTRCQTBDMDg5NUY5XFxuOjEwMTRFMDAwMzgyRjQxMzIxMEYwNDBFMDQyQzA4MDkxMDYwMzg4MjMzQlxcbjoxMDE0RjAwMEUxRjc5MUUwOTA5MzA2MDMyMDkzMDgwMzhGRUY4MDkzMjhcXG46MTAxNTAwMDA3MzAzMTA5MjJFMDM0MTUwNDA5MzJGMDM0RjVGOTA5MzJCXFxuOjEwMTUxMDAwMDcwMzgwOTEwNzAzMzMwRjgzMkI4MDkzMDcwMzgwOTE4OFxcbjoxMDE1MjAwMDA5MDM4MTMwNDFGNDEwOTIwOTAzODA5MTA3MDM4MDkzRURcXG46MTAxNTMwMDBCQjAwODVFQzAxQzA4NUVFODA5M0JDMDA4MDkxMDYwMzYyXFxuOjEwMTU0MDAwODEzMEUxRjM4MDkxMkUwMzg0MTcxMEY0NDA5MTJFMDMzM1xcbjoxMDE1NTAwMDIwRTAzMEUwMEFDMEZCMDFFMjBGRjMxRkQ5MDFBMjVGRDdcXG46MTAxNTYwMDBCQzRGOEM5MTgwODMyRjVGM0Y0RjI0MTdBMEYzODQyRkIzXFxuOjEwMTU3MDAwMDg5NTBGOTMxRjkzNTgyRjEyMkY0MTMyMTBGMDgxRTBERVxcbjoxMDE1ODAwMDRBQzA4MDkxMDYwMzg4MjNFMUY3ODJFMDgwOTMwNjAzMzZcXG46MTAxNTkwMDAwMDkzMDgwMzhGRUY4MDkzNzMwMzEwOTIyRTAzNDA5MzAwXFxuOjEwMTVBMDAwMkYwM0FFRTBCM0UwRkIwMTAyQzA4MTkxOEQ5MzhFMkYzQlxcbjoxMDE1QjAwMDg2MUI4NDE3RDBGMzEwOTIwNzAzODA5MTA3MDM1NTBGMDFcXG46MTAxNUMwMDA4NTJCODA5MzA3MDM4MDkxMDkwMzgxMzA0MUY0MTA5MkE5XFxuOjEwMTVEMDAwMDkwMzgwOTEwNzAzODA5M0JCMDA4NUVDMDFDMDg1RUU3MVxcbjoxMDE1RTAwMDgwOTNCQzAwMTEyMzIxRjA4MDkxMDYwMzgyMzBFMUYzNDdcXG46MTAxNUYwMDA4MDkxNzMwMzhGM0YxMUY0ODBFMDBEQzA4MDkxNzMwM0REXFxuOjEwMTYwMDAwODAzMjExRjQ4MkUwMDdDMDgwOTE3MzAzODAzMzExRjBCRlxcbjoxMDE2MTAwMDg0RTAwMUMwODNFMDFGOTEwRjkxMDg5NTQ4MkY2MTMyNEJcXG46MTAxNjIwMDAxMEYwODFFMDA4OTU4MDkxMDYwMzg0MzAxMUYwODJFMDhCXFxuOjEwMTYzMDAwMDg5NTYwOTM1MTAzQTBFM0IzRTA4NDJGOUMwMUY5MDE2NlxcbjoxMDE2NDAwMDAyQzA4MTkxOEQ5MzhFMkY4NDFCODYxN0QwRjM4MEUwOEFcXG46MTAxNjUwMDAwODk1MUY5MjBGOTIwRkI2MEY5MjExMjQyRjkzM0Y5MzZDXFxuOjEwMTY2MDAwNEY5MzVGOTM2RjkzN0Y5MzhGOTM5RjkzQUY5M0JGOTNBQVxcbjoxMDE2NzAwMEVGOTNGRjkzODA5MUI5MDA5MEUwODg3RjkwNzA4MDM2NUZcXG46MTAxNjgwMDA5MTA1MDlGNEYyQzA4MTM2OTEwNUNDRjU4ODMyOTEwNUI3XFxuOjEwMTY5MDAwMDlGNDdCQzA4OTMyOTEwNUI0RjQ4MDMxOTEwNTA5RjRENVxcbjoxMDE2QTAwMDZGQzA4MTMxOTEwNTNDRjQwMDk3MDlGNDQ3QzEwODk3NThcXG46MTAxNkIwMDAwOUYwNEZDMTY1QzA4ODMxOTEwNTA5RjQ2NkMwODA5NzczXFxuOjEwMTZDMDAwMDlGMDQ3QzE4MkMwODAzNDkxMDUwOUY0QTRDMDgxMzQ3N1xcbjoxMDE2RDAwMDkxMDU0NEY0ODAzMzkxMDUwOUY0ODJDMEM4OTcwOUYwNUNcXG46MTAxNkUwMDAzOEMxODlDMDgwMzU5MTA1MDlGNDg5QzA4ODM1OTEwNUQ0XFxuOjEwMTZGMDAwMDlGNDk2QzA4ODM0OTEwNTA5RjAyQkMxQUVDMDg4MzkzMVxcbjoxMDE3MDAwMDkxMDUwOUY0MTNDMTg5Mzk5MTA1RUNGNDg4Mzc5MTA1RTVcXG46MTAxNzEwMDAwOUY0QUJDMDg5Mzc5MTA1NENGNDg4MzY5MTA1MDlGNDdBXFxuOjEwMTcyMDAwQTRDMDgwMzc5MTA1MDlGMDE0QzE5RkMwODgzODkxMDU4NVxcbjoxMDE3MzAwMDA5RjRGQ0MwODAzOTkxMDUwOUY0OURDMDgwMzg5MTA1RjlcXG46MTAxNzQwMDAwOUYwMDdDMTk4QzA4MDNCOTEwNTA5RjRDNkMwODEzQkYwXFxuOjEwMTc1MDAwOTEwNTRDRjQ4MDNBOTEwNTA5RjQ5RkMwODgzQTkxMDVBRlxcbjoxMDE3NjAwMDA5RjBGN0MwQkFDMDgwM0M5MTA1MDlGNEUzQzA4ODNDOTlcXG46MTAxNzcwMDA5MTA1MDlGNERGQzA4ODNCOTEwNTA5RjBFQUMwQzJDMEI5XFxuOjEwMTc4MDAwODA5MTA3MDM4MDkzQkIwMENGQzA5MDkxMkUwMzgwOTE3RVxcbjoxMDE3OTAwMDJGMDM5ODE3NjhGNDkwOTEyRTAzRTkyRkYwRTBFMjVGOTFcXG46MTAxN0EwMDBGQzRGODA4MTgwOTNCQjAwOUY1RjkwOTMyRTAzQkNDMDUxXFxuOjEwMTdCMDAwODA5MTA4MDM4ODIzMDlGNDRCQzA4NUVEODA5M0JDMDAxOVxcbjoxMDE3QzAwMDgwOTFCQzAwODRGREZDQ0ZDMkMwODBFMjgwOTM3MzAzOTNcXG46MTAxN0QwMDA4NUVEODA5M0JDMDA4MDkxQkMwMDg0RkRGQ0NGQjdDMDM4XFxuOjEwMTdFMDAwODBFMzgwOTM3MzAzODVFRDgwOTNCQzAwODA5MUJDMDBGRlxcbjoxMDE3RjAwMDg0RkRGQ0NGQUNDMDg4RTM4MDkzNzMwMzlCQzA4MDkxRDFcXG46MTAxODAwMDAyRTAzOTA5MUJCMDBFODJGRjBFMEUyNUZGQzRGOTA4MzQ1XFxuOjEwMTgxMDAwOEY1RjgwOTMyRTAzOTA5MTJFMDM4MDkxMkYwMzgyQzBCRlxcbjoxMDE4MjAwMDgwOTEyRTAzOTA5MUJCMDBFODJGRjBFMEUyNUZGQzRGMjdcXG46MTAxODMwMDA5MDgzOEY1RjgwOTMyRTAzODA5MTA4MDM4ODIzNDFGMDZCXFxuOjEwMTg0MDAwODVFRDgwOTNCQzAwODA5MUJDMDA4NEZERkNDRjdGQzBGRlxcbjoxMDE4NTAwMDgxRTA4MDkzMDkwMzg0RUE2RUMwODVFRDgwOTNCQzAwMkJcXG46MTAxODYwMDA4MDkxQkMwMDg0RkRGQ0NGNzJDMDgzRTA4MDkzMDYwM0FFXFxuOjEwMTg3MDAwMTA5MjcyMDM1OUMwODA5MTcyMDM4MDMyMDhGMDU2QzBGMlxcbjoxMDE4ODAwMDgwOTE3MjAzOTA5MUJCMDBFODJGRjBFMEVFNUFGQzRGN0NcXG46MTAxODkwMDA5MDgzOEY1RjgwOTM3MjAzNDdDMDgwOTE3MjAzODAzMjgwXFxuOjEwMThBMDAwMzBGNEUwOTE3MjAzRjBFMEVFNUFGQzRGMTA4Mjg1RURDN1xcbjoxMDE4QjAwMDgwOTNCQzAwODA5MUJDMDA4NEZERkNDRjEwOTIwNjAzOTVcXG46MTAxOEMwMDA2MDkxNzIwM0UwOTEwQzAzRjA5MTBEMDM4MkU1OTNFMEM3XFxuOjEwMThEMDAwNzBFMDA5OTUxMDkyNzIwMzJEQzA4NEUwODA5MzA2MDM5NlxcbjoxMDE4RTAwMDEwOTI1MDAzMTA5MjUxMDNFMDkxMEEwM0YwOTEwQjAzMDBcXG46MTAxOEYwMDAwOTk1ODA5MTUxMDM4ODIzMjlGNDgxRTA4MDkzNTEwMzU1XFxuOjEwMTkwMDAwMTA5MjMwMDM5MDkxNTAwM0U5MkZGMEUwRTA1REZDNEYxRVxcbjoxMDE5MTAwMDgwODE4MDkzQkIwMDlGNUY5MDkzNTAwMzkwOTE1MDAzMTBcXG46MTAxOTIwMDA4MDkxNTEwMzk4MTcxMEY0ODVFQzAxQzA4NUU4ODA5M0VEXFxuOjEwMTkzMDAwQkMwMDBGQzA4NUVDODA5M0JDMDAwOUMwMTA5MjczMDNGQlxcbjoxMDE5NDAwMDg1RUQ4MDkzQkMwMDgwOTFCQzAwODRGREZDQ0YxMDkyOUJcXG46MTAxOTUwMDAwNjAzRkY5MUVGOTFCRjkxQUY5MTlGOTE4RjkxN0Y5MTdFXFxuOjEwMTk2MDAwNkY5MTVGOTE0RjkxM0Y5MTJGOTEwRjkwMEZCRTBGOTAwQ1xcbjoxMDE5NzAwMDFGOTAxODk1MTA5MjA2MDM4MUUwODA5MzA4MDMxMDkyM0ZcXG46MTAxOTgwMDAwOTAzODJFMTYxRTAwRTk0NjgxMzgzRTE2MUUwMEU5NDQzXFxuOjEwMTk5MDAwNjgxM0U5RUJGMEUwODA4MThFN0Y4MDgzODA4MThEN0YwQVxcbjoxMDE5QTAwMDgwODM4OEU0ODA5M0I4MDA4NUU0ODA5M0JDMDAwODk1MjhcXG46MTAxOUIwMDBFRjkyRkY5MjBGOTMxRjkzN0MwMThCMDFEQzAxRUQ5MTVEXFxuOjEwMTlDMDAwRkM5MUEwODFCMTgxNkY3NzJEOTEzQzkxQ0YwMUY5MDFGQ1xcbjoxMDE5RDAwMDA5OTVENzAxRUQ5MUZDOTFBMDgxQjE4MTAwMEYwMTJGRjRcXG46MTAxOUUwMDAwMDFGMTEwQjBGNzcyRDkxM0M5MUNGMDE2MDJGRjkwMTUyXFxuOjEwMTlGMDAwMDk5NTFGOTEwRjkxRkY5MEVGOTAwODk1RkMwMTAxOTBDMFxcbjoxMDFBMDAwMEYwODFFMDJEQTA4MUIxODEyRDkxM0M5MUNGMDE2MEVGNUJcXG46MTAxQTEwMDBGOTAxMDk5NTA4OTVGQzAxMDE5MEYwODFFMDJEQTA4MTY0XFxuOjEwMUEyMDAwQjE4MTJEOTEzQzkxQ0YwMTY3RUZGOTAxMDk5NTA4OTU5RVxcbjoxMDFBMzAwMDBGOTMxRjkzOEMwMURDMDFFRDkxRkM5MUEwODFCMTgxOEFcXG46MTAxQTQwMDAyRDkxM0M5MUNGMDE2OUVGRjkwMTA5OTVEODAxRUQ5MUY0XFxuOjEwMUE1MDAwRkM5MUEwODFCMTgxMkQ5MTNDOTFDRjAxNjJFMEY5MDEwRlxcbjoxMDFBNjAwMDA5OTVEODAxRUQ5MUZDOTFBMDgxQjE4MTJEOTEzQzkxMTZcXG46MTAxQTcwMDBDRjAxNjNFMEY5MDEwOTk1MUY5MTBGOTEwODk1MUY5MzFDXFxuOjEwMUE4MDAwQ0Y5M0RGOTNFQzAxOEE4MTg4MjNDOUYxQ0UwMTBFOTRCNFxcbjoxMDFBOTAwMEZFMENFODgxRjk4MUEwODFCMTgxMkQ5MTNDOTFDRjAxQUJcXG46MTAxQUEwMDA2OUU3RjkwMTA5OTVFODgxRjk4MUEwODFCMTgxMkI4MTZDXFxuOjEwMUFCMDAwM0M4MTREOTE1QzkxQ0YwMUY5MDE2MDgxRkEwMTA5OTU1QVxcbjoxMDFBQzAwMEU4ODFGOTgxQTA4MUIxODEyQjgxM0M4MTREOTE1QzkxQUNcXG46MTAxQUQwMDBDRjAxRjkwMTYxODFGQTAxMDk5NTEyRTAwQUMwRUI4MTk5XFxuOjEwMUFFMDAwRkM4MUUxMEZGMTFENjA4MUNFMDE3MEUwMEU5NEQ4MENGNVxcbjoxMDFBRjAwMDFGNUY4QTgxMTgxNzk4RjNDRTAxMEU5NDBCMERERjkxQUFcXG46MTAxQjAwMDBDRjkxMUY5MTA4OTVGQzAxQTA4MUIxODFFRDkxRkM5MUNEXFxuOjEwMUIxMDAwMTE5NzA0ODBGNTgxRTAyRENEMDEwOTk1MDg5NUVGOTI4Q1xcbjoxMDFCMjAwMEZGOTIwRjkzMUY5MzhDMDE3QTAxREMwMUVEOTFGQzkxRTBcXG46MTAxQjMwMDBBMDgxQjE4MTZGNzA2MDZFMkQ5MTNDOTFDRjAxRjkwMTUwXFxuOjEwMUI0MDAwMDk5NUM4MDFCNzAxMEU5NEQ4MEMxRjkxMEY5MUZGOTAxMVxcbjoxMDFCNTAwMEVGOTAwODk1RUY5MkZGOTIwRjkzMUY5MzdDMDE4QTAxRkJcXG46MTAxQjYwMDBEQzAxRUQ5MUZDOTFBMDgxQjE4MTZGNzA2MDY5MkQ5MUQ0XFxuOjEwMUI3MDAwM0M5MUNGMDFGOTAxMDk5NUQ3MDFFRDkxRkM5MUEwODEyQ1xcbjoxMDFCODAwMEIxODE2MDJGNkY3NzJEOTEzQzkxQ0YwMUY5MDEwOTk1QkJcXG46MTAxQjkwMDBENzAxRUQ5MUZDOTFBMDgxQjE4MTAwMEYwMTJGMDAxRkIxXFxuOjEwMUJBMDAwMTEwQjJEOTEzQzkxQ0YwMTYwMkZGOTAxMDk5NTFGOTFFN1xcbjoxMDFCQjAwMDBGOTFGRjkwRUY5MDA4OTVERjkyRUY5MkZGOTIwRjkzQjVcXG46MTAxQkMwMDAxRjkzQ0Y5M0RGOTNFQzAxMTYyRkQ0MkUwMjJGRjMyRTA5XFxuOjEwMUJEMDAwMEU5NEZFMENFODgxRjk4MUEwODFCMTgxMkQ5MTNDOTE5OFxcbjoxMDFCRTAwMENGMDE2MTJGRjkwMTA5OTUyMDJGM0YyREM5MDE3QzAxRkJcXG46MTAxQkYwMDAxMEUwMDhDMEY3MDE2MTkxN0YwMUNFMDE3MEUwMEU5NDAyXFxuOjEwMUMwMDAwRDgwQzFGNUYxRDE1QjBGM0NFMDEwRTk0MEIwRERGOTFBNFxcbjoxMDFDMTAwMENGOTExRjkxMEY5MUZGOTBFRjkwREY5MDA4OTVGQzAxRkRcXG46MTAxQzIwMDA2MDNEQTlGMDYxM0QyOEY0NjAzOTU5RjA2MDNDQTFGNEIxXFxuOjEwMUMzMDAwMEJDMDYwM0UxOUYwNjQzRjc5RjQwQ0MwNTRBNzQzQTc3MVxcbjoxMDFDNDAwMDA4OTU1NkE3NDVBNzA4OTU1MEFCNDdBNzA4OTU1MkFCRUVcXG46MTAxQzUwMDA0MUFCMDg5NTU0QUI0M0FCMDg5NUZDMDE2RjNGMTFGNEMxXFxuOjEwMUM2MDAwNTZBQjQ1QUIwODk1RkMwMTUyQUY0MUFGMDg5NUZDMDE1RVxcbjoxMDFDNzAwMDE1ODIxNjgyMTc4MkRDMDE4MEUwMTg5NjFDOTIxODk3NTRcXG46MTAxQzgwMDA4RjVGMTE5NjgwMzJDOUY3MTBBNjEyQTYxMUE2MDVBODdCXFxuOjEwMUM5MDAwRjZBOUUwMkQzMDk3MDlGMDA5OTUwODk1RkMwMTcxODNBQ1xcbjoxMDFDQTAwMDYwODMxMjgyMEU5NDM3MEUwODk1ODRFNzkzRTA2MEU0MTdcXG46MTAxQ0IwMDA3NEUwMEU5NDRFMEUwODk1NEY5MjVGOTI2RjkyN0Y5MjUxXFxuOjEwMUNDMDAwOEY5MjlGOTJBRjkyQkY5MkNGOTJERjkyRUY5MkZGOTI0Q1xcbjoxMDFDRDAwMDBGOTNERjkzQ0Y5MzAwRDBDREI3REVCNzJCMDE3QTAxRkVcXG46MTAxQ0UwMDAzQTgzMjk4MzhERTA2MUUwMEU5NDI5MTMwMEUwODk4MTE1XFxuOjEwMUNGMDAwOUE4MTNDMDE4ODI0NzdGQzgwOTQ5ODJDNTcwMUNDMjQ0RFxcbjoxMDFEMDAwMEI3RkNDMDk0REMyQzExQzBDNDAxQjMwMTBFOTQwOTEyQkRcXG46MTAxRDEwMDA4REUwNjFFMDBFOTQ2ODEzQzYwMUI1MDEwRTk0MDkxMkJFXFxuOjEwMUQyMDAwOERFMDYwRTAwRTk0NjgxMzBGNUY4MDJGOTBFMDg0MTVDM1xcbjoxMDFEMzAwMDk1MDU1NEYzMEY5MDBGOTBDRjkxREY5MTBGOTFGRjkwODVcXG46MTAxRDQwMDBFRjkwREY5MENGOTBCRjkwQUY5MDlGOTA4RjkwN0Y5MDVCXFxuOjEwMUQ1MDAwNkY5MDVGOTA0RjkwMDg5NTBGOTMxRjkzOEMwMThERTBDQlxcbjoxMDFENjAwMDYxRTAwRTk0MjkxM0M4MDE2MkUwNzBFMDQ4RTI1MEUwOUZcXG46MTAxRDcwMDAyMkVEMzBFMDBFOTQ1QzBFNkFFRjcwRTA4MEUwOTBFMEJGXFxuOjEwMUQ4MDAwMEU5NDA5MTJDODAxNjNFMDcwRTA0OEUyNTBFMDIyRUREMVxcbjoxMDFEOTAwMDMwRTAwRTk0NUMwRTZERTc3MEUwODBFMDkwRTAwRTk0MTFcXG46MTAxREEwMDAwOTEyMUY5MTBGOTEwODk1OUEwMUZBMDEwMTkwMDAyMEU0XFxuOjEwMURCMDAwRTlGNzMxOTdFNDFCRjUwQjRFMkYwRTk0REMwRDA4OTVEN1xcbjoxMDFEQzAwMEFCMDE2MUU3MEU5NEQ0MEUwODk1MUY5M0NGOTNERjkzNzhcXG46MTAxREQwMDBFQzAxODg4NTgxMzczMUYwODkzNzg5RjVDRTAxMEU5NDgxXFxuOjEwMURFMDAwM0YwRDM2QzA4RkE5OThBRDg5MkI5MUYxODlBNTlBQTU5MVxcbjoxMDFERjAwMDAxOTc2MkUwNzBFMDBFOTQ4NDE2MTYyRjg2MkY5MEUwMTNcXG46MTAxRTAwMDAwRTk0N0UxMEFDMDFEQzAxMjFFMDMwRTAxMUMwRkUwMTM3XFxuOjEwMUUxMDAwRTIwRkYxMUQ5MDg1OUM5MzJGNUZGRTAxRTIwRkYxMURGM1xcbjoxMDFFMjAwMDgwODU4Nzk1ODgyNzg3OTU4OTBGOEQ5MzJGNUYzRjVGRTJcXG46MTAxRTMwMDAzMTE3NjhGM0VGQTlGOEFEQ0EwMTA5OTUwOUMwRTlBREZBXFxuOjEwMUU0MDAwRkFBRDMwOTcyOUYwNjlBNTYxNTAyOTk2QUUwMTA5OTU0MFxcbjoxMDFFNTAwMERGOTFDRjkxMUY5MTA4OTVDRjkzREY5M0VDMDFBODgxN0JcXG46MTAxRTYwMDBCOTgxRUQ5MUZDOTExMTk3MDY4MEY3ODFFMDJEQ0QwMUFDXFxuOjEwMUU3MDAwMDk5NUFDMDE4OEE1ODgyMzkxRjA0NzNGNTEwNTI5RjRDNVxcbjoxMDFFODAwMDE4QTZDRTAxMEU5NEU1MEU5M0MwODlBNTlBQTVGRTAxNzFcXG46MTAxRTkwMDBFODBGRjkxRjQwODcwMTk2OUFBNzg5QTc4OUMwOEQ4MTBEXFxuOjEwMUVBMDAwODgyMzA5RjQ0NkMwNDAzODUxMDUwQ0YwNDJDMDgxNTBFN1xcbjoxMDFFQjAwMDhEODNGRTAxRTgwRkYxMUQ0MDg3ODgyMzA5RjA3OEMwNkJcXG46MTAxRUMwMDA4RTgxODgyMzA5RjQ3NEMwODAzRDQ5RjE4MTNEMjhGNDU2XFxuOjEwMUVEMDAwODAzOTU5RjA4MDNDNTlGNTFGQzA4MDNFMTlGMDg0M0Y4RFxcbjoxMDFFRTAwMDMxRjUxM0MwRUJBNUZDQTUwMkMwRURBNUZFQTUzMDk3MEFcXG46MTAxRUYwMDBGMUYwNjg4NTcwRTA3Njk1NzYyRjY2Mjc3Nzk1Njc5NTdGXFxuOjEwMUYwMDAwODk4NTY4MEY3MTFEOEY4MTExQzBFQkE5RkNBOTMwOTdERFxcbjoxMDFGMTAwMDcxRjA2ODg1ODk4NTA5QzBFRkE1RjhBOTAyQzBFOUE5MTNcXG46MTAxRjIwMDBGQUE5MzA5NzIxRjA2ODg1OEY4MTcwRTAwOTk1MUU4MkFCXFxuOjEwMUYzMDAwM0ZDMDQwM0Y1MTA1MTRGMDlBMDEwNkMwOUEwMTIwN0YyRVxcbjoxMDFGNDAwMDMwNzA4NDJGOEY3MDhGODMyMDNFMzEwNUYxRjAyMTNFNTlcXG46MTAxRjUwMDAzMTA1NTRGNDIwM0MzMTA1RDFGMDIwM0QzMTA1QjlGMDc0XFxuOjEwMUY2MDAwMjAzOTMxMDUyOUY1MTFDMDI0M0YzMTA1NzFGMDI1M0Y5NVxcbjoxMDFGNzAwMDMxMDUyNEY0MjAzRjMxMDVEOUY0MERDMDI5M0YzMTA1NDZcXG46MTAxRjgwMDA5OUYwMkYzRjMxMDVBMUY0MEJDMDgyRTAwMUMwODFFMDQwXFxuOjEwMUY5MDAwOEQ4MzJFODMwREMwODFFMDg4QTcxQUE2MTlBNjA4QzBEQ1xcbjoxMDFGQTAwMENFMDEwRTk0MzcwRTA0QzA4NEU3OTNFMDBFOTQxODBEMTJcXG46MTAxRkIwMDBERjkxQ0Y5MTA4OTVBRjkyQkY5MkNGOTJERjkyRUY5MkNGXFxuOjEwMUZDMDAwRkY5MjBGOTMxRjkzQ0Y5M0RGOTM4QzAxRDYyRUM3MkVEMlxcbjoxMDFGRDAwMEI0MkVBMjJFODYyRjk3MkY2MUVCNzFFMDBFOTRBOTAwRUNcXG46MTAxRkUwMDBFQzAxOEQyRDlDMkQ2RkUyNzBFMDBFOTQ5RTAwMjA5N0U5XFxuOjEwMUZGMDAwNzlGMDdDMDEwODk0RTExQ0YxMUNFMTE0RjEwNDQxRjAzQVxcbjoxMDIwMDAwMDlFMDEyRTVGODIyRjhFMTlEODAxMTI5NjhDOTMwRkMwRERcXG46MTAyMDEwMDBBRDJEQkMyREZEMDEwMTkwMDAyMEU5RjdFRDE5RUY1RjFBXFxuOjEwMjAyMDAwRDgwMTEyOTZFQzkzMkQyRDNDMkRDOTAxN0MwMUY4MDFBRFxcbjoxMDIwMzAwMDgyODE5MEUwMEU5NDdFMTBGQzAxRDgwMTE0OTY5QzkzNEVcXG46MTAyMDQwMDA4RTkzMTM5NzEyOTY4QzkxMTI5N0U4MEZGMTFEMTA4MkMwXFxuOjEwMjA1MDAwMTM5NkVEOTFGQzkxMTQ5N0IwODIxMzk2RUQ5MUZDOTEzQlxcbjoxMDIwNjAwMDE0OTdBMTgyMTM5NjhEOTE5QzkxMTQ5NzEyOTY0QzkxN0VcXG46MTAyMDcwMDA1MEUwNDI1MDUwNDAwMjk2QjcwMTBFOTQ4RjAwREY5MTFEXFxuOjEwMjA4MDAwQ0Y5MTFGOTEwRjkxRkY5MEVGOTBERjkwQ0Y5MEJGOTA3NVxcbjoxMDIwOTAwMEFGOTAwODk1MEY5MzFGOTM4QzAxODBFNDk0RTAwRTk0MDlcXG46MTAyMEEwMDA0QTE0RDgwMUVEOTFGQzkxODA5MTQyMDQ5MDkxNDMwNDJGXFxuOjEwMjBCMDAwOTM4MzgyODM4MDkxNDQwNDkwOTE0NTA0QTA5MTQ2MDRDN1xcbjoxMDIwQzAwMEIwOTE0NzA0ODQ4Mzk1ODNBNjgzQjc4MzgwOTE0ODA0QTVcXG46MTAyMEQwMDA5MDkxNDkwNEEwOTE0QTA0QjA5MTRCMDQ4MDg3OTE4NzY0XFxuOjEwMjBFMDAwQTI4N0IzODdDODAxMEU5NEFDMEVDODAxMEU5NDE4MEREOFxcbjoxMDIwRjAwMEM4MDEwRTk0M0YwRDFGOTEwRjkxMDg5NTBGOTMxRjkzRThcXG46MTAyMTAwMDBDRjkzREY5M0JDMDE4MjMwOTEwNTEwRjQ2MkUwNzBFMDYwXFxuOjEwMjExMDAwRTA5MTY0MDRGMDkxNjUwNEEwRTBCMEUwNDBFMDUwRTA5Q1xcbjoxMDIxMjAwMDI0QzA4MDgxOTE4MTg2MTc5NzA3RDBGMDg2MTc5NzA3ODJcXG46MTAyMTMwMDA3MUY0ODI4MTkzODExMDk3MjlGMDEzOTY5QzkzOEU5MzZBXFxuOjEwMjE0MDAwMTI5NzJDQzA5MDkzNjUwNDgwOTM2NDA0MjdDMDQxMTVCNlxcbjoxMDIxNTAwMDUxMDUxOUYwODQxNzk1MDcxOEY0RUYwMThEMDFBQzAxQjJcXG46MTAyMTYwMDBERjAxODI4MTkzODE5QzAxRjkwMTMwOTdEMUY2NDExNUZEXFxuOjEwMjE3MDAwNTEwNUY5RjBDQTAxODYxQjk3MEI4NDMwOTEwNTgwRjQ1NFxcbjoxMDIxODAwMDhBODE5QjgxMDExNTExMDUyMUYwRjgwMTkzODM4MjgzRDdcXG46MTAyMTkwMDAwNEMwOTA5MzY1MDQ4MDkzNjQwNEZFMDEzMjk2NDVDMEE4XFxuOjEwMjFBMDAwRkUwMUU4MEZGOTFGNjE5MzcxOTMwMjk3OTk4Mzg4ODM2OVxcbjoxMDIxQjAwMDNDQzA4MDkxNjIwNDkwOTE2MzA0ODkyQjQxRjQ4MDkxMkFcXG46MTAyMUMwMDBCQjAxOTA5MUJDMDE5MDkzNjMwNDgwOTM2MjA0NDA5MUExXFxuOjEwMjFEMDAwQkQwMTUwOTFCRTAxNDExNTUxMDU0MUY0NERCNzVFQjdBN1xcbjoxMDIxRTAwMDgwOTFCOTAxOTA5MUJBMDE0ODFCNTkwQjIwOTE2MjA0NkFcXG46MTAyMUYwMDAzMDkxNjMwNDI0MTczNTA3QjBGNENBMDE4MjFCOTMwQjk2XFxuOjEwMjIwMDAwODYxNzk3MDc4MEYwQUIwMTRFNUY1RjRGODQxNzk1MDdFNVxcbjoxMDIyMTAwMDUwRjA0MjBGNTMxRjUwOTM2MzA0NDA5MzYyMDRGOTAxM0VcXG46MTAyMjIwMDA2MTkzNzE5MzAyQzBFMEUwRjBFMENGMDFERjkxQ0Y5MUM0XFxuOjEwMjIzMDAwMUY5MTBGOTEwODk1Q0Y5M0RGOTM5QzAxMDA5NzA5RjRBQ1xcbjoxMDIyNDAwMDhGQzBFQzAxMjI5NzFCODIxQTgyNjA5MTY0MDQ3MDkxMDZcXG46MTAyMjUwMDA2NTA0NjExNTcxMDU4MUY0ODg4MTk5ODE4MjBGOTMxRjRFXFxuOjEwMjI2MDAwMjA5MTYyMDQzMDkxNjMwNDI4MTczOTA3MzlGNUQwOTMxRlxcbjoxMDIyNzAwMDYzMDRDMDkzNjIwNDc0QzBEQjAxNDBFMDUwRTBBQzE3MUJcXG46MTAyMjgwMDBCRDA3MDhGMUJCODNBQTgzRkUwMTIxOTEzMTkxRTIwRkMyXFxuOjEwMjI5MDAwRjMxRkFFMTdCRjA3NzlGNDhEOTE5QzkxMTE5NzI4MEYwQVxcbjoxMDIyQTAwMDM5MUYyRTVGM0Y0RjM5ODMyODgzMTI5NjhEOTE5QzkxNjFcXG46MTAyMkIwMDAxMzk3OUI4MzhBODM0MTE1NTEwNTcxRjREMDkzNjUwNDZDXFxuOjEwMjJDMDAwQzA5MzY0MDQ0REMwMTI5NjhEOTE5QzkxMTM5N0FEMDFGQlxcbjoxMDIyRDAwMDAwOTcxMUYwREMwMUQzQ0ZEQTAxMTM5NkRDOTNDRTkzOTNcXG46MTAyMkUwMDAxMjk3RkEwMTIxOTEzMTkxRTIwRkYzMUZDRTE3REYwNzA4XFxuOjEwMjJGMDAwNjlGNDg4ODE5OTgxMjgwRjM5MUYyRTVGM0Y0RkZBMDFCOVxcbjoxMDIzMDAwMDMxODMyMDgzOEE4MTlCODE5MzgzODI4M0UwRTBGMEUwQTRcXG46MTAyMzEwMDBEQjAxMTI5NjhEOTE5QzkxMTM5NzAwOTcxOUYwQkMwMUU3XFxuOjEwMjMyMDAwRkQwMUY2Q0ZBQjAxNEU1RjVGNEZEQjAxOEQ5MTlDOTFCQ1xcbjoxMDIzMzAwMDg0MEY5NTFGMjA5MTYyMDQzMDkxNjMwNDI4MTczOTA3OThcXG46MTAyMzQwMDA3OUY0MzA5NzI5RjQxMDkyNjUwNDEwOTI2NDA0MDJDMDY1XFxuOjEwMjM1MDAwMTM4MjEyODI0MjUwNTA0MDUwOTM2MzA0NDA5MzYyMDRBRlxcbjoxMDIzNjAwMERGOTFDRjkxMDg5NTFGOTIwRjkyMEZCNjBGOTIxMTI0MTNcXG46MTAyMzcwMDAyRjkzM0Y5MzhGOTM5RjkzQUY5M0JGOTM4MDkxQjMwMzFBXFxuOjEwMjM4MDAwOTA5MUI0MDNBMDkxQjUwM0IwOTFCNjAzMzA5MUI3MDMxN1xcbjoxMDIzOTAwMDAxOTZBMTFEQjExRDIzMkYyRDVGMkQzNzIwRjAyRDU3NDRcXG46MTAyM0EwMDAwMTk2QTExREIxMUQyMDkzQjcwMzgwOTNCMzAzOTA5M0IxXFxuOjEwMjNCMDAwQjQwM0EwOTNCNTAzQjA5M0I2MDM4MDkxQUYwMzkwOTE5QlxcbjoxMDIzQzAwMEIwMDNBMDkxQjEwM0IwOTFCMjAzMDE5NkExMURCMTFENUNcXG46MTAyM0QwMDA4MDkzQUYwMzkwOTNCMDAzQTA5M0IxMDNCMDkzQjIwMzgzXFxuOjEwMjNFMDAwQkY5MUFGOTE5RjkxOEY5MTNGOTEyRjkxMEY5MDBGQkUxMVxcbjoxMDIzRjAwMDBGOTAxRjkwMTg5NThGQjdGODk0MjA5MUIzMDMzMDkxRThcXG46MTAyNDAwMDBCNDAzNDA5MUI1MDM1MDkxQjYwMzhGQkZCOTAxQ0EwMTFGXFxuOjEwMjQxMDAwMDg5NTlCMDFBQzAxN0ZCN0Y4OTQ4MDkxQUYwMzkwOTEzMFxcbjoxMDI0MjAwMEIwMDNBMDkxQjEwM0IwOTFCMjAzNjZCNUE4OUIwNUMwRkJcXG46MTAyNDMwMDA2RjNGMTlGMDAxOTZBMTFEQjExRDdGQkZCQTJGQTkyRkMzXFxuOjEwMjQ0MDAwOTgyRjg4Mjc4NjBGOTExREExMURCMTFENjJFMDg4MEY2RVxcbjoxMDI0NTAwMDk5MUZBQTFGQkIxRjZBOTVEMUY3QkMwMTJEQzBGRkI3RkFcXG46MTAyNDYwMDBGODk0ODA5MUFGMDM5MDkxQjAwM0EwOTFCMTAzQjA5MTIzXFxuOjEwMjQ3MDAwQjIwM0U2QjVBODlCMDVDMEVGM0YxOUYwMDE5NkExMUQ3OFxcbjoxMDI0ODAwMEIxMURGRkJGQkEyRkE5MkY5ODJGODgyNzhFMEY5MTFEM0VcXG46MTAyNDkwMDBBMTFEQjExREUyRTA4ODBGOTkxRkFBMUZCQjFGRUE5NTdEXFxuOjEwMjRBMDAwRDFGNzg2MUI5NzBCODg1RTkzNDBDOEYyMjE1MDMwNDBDRFxcbjoxMDI0QjAwMDQwNDA1MDQwNjg1MTdDNEYyMTE1MzEwNTQxMDU1MTA1ODBcXG46MTAyNEMwMDA3MUY2MDg5NTAxOTczOUYwODgwRjk5MUY4ODBGOTkxRkE5XFxuOjEwMjREMDAwMDI5NzAxOTdGMUY3MDg5NTc4OTQ4NEI1ODI2MDg0QkRERVxcbjoxMDI0RTAwMDg0QjU4MTYwODRCRDg1QjU4MjYwODVCRDg1QjU4MTYwMThcXG46MTAyNEYwMDA4NUJERUVFNkYwRTA4MDgxODE2MDgwODNFMUU4RjBFMDc4XFxuOjEwMjUwMDAwMTA4MjgwODE4MjYwODA4MzgwODE4MTYwODA4M0UwRThBNlxcbjoxMDI1MTAwMEYwRTA4MDgxODE2MDgwODNFMUVCRjBFMDgwODE4NDYwODVcXG46MTAyNTIwMDA4MDgzRTBFQkYwRTA4MDgxODE2MDgwODNFQUU3RjBFMDg3XFxuOjEwMjUzMDAwODA4MTg0NjA4MDgzODA4MTgyNjA4MDgzODA4MTgxNjBFQlxcbjoxMDI1NDAwMDgwODM4MDgxODA2ODgwODMxMDkyQzEwMDA4OTU5ODJGRDVcXG46MTAyNTUwMDA4RTMwMDhGMDlFNTA5NzcwODA5MUJGMDE4Mjk1ODgwRjUxXFxuOjEwMjU2MDAwODgwRjgwN0M4OTJCODA5MzdDMDA4MDkxN0EwMDgwNjQyNlxcbjoxMDI1NzAwMDgwOTM3QTAwODA5MTdBMDA4NkZERkNDRjIwOTE3ODAwQ0NcXG46MTAyNTgwMDA0MDkxNzkwMDk0MkY4MEUwMzBFMDI4MkIzOTJCQzkwMTREXFxuOjEwMjU5MDAwMDg5NTFGOTNDRjkzREY5MzE4MkZFQjAxNjFFMDBFOTQwMlxcbjoxMDI1QTAwMDI5MTMyMDk3MDlGNDRBQzBDRjNGRDEwNTA5RjQ0OUMwNDdcXG46MTAyNUIwMDBFMTJGRjBFMEUyNTVGRjRGODQ5MTgzMzBDMUYwODQzMDg5XFxuOjEwMjVDMDAwMjhGNDgxMzA1MUYwODIzMEIxRjUwQ0MwODYzMDE5RjExOVxcbjoxMDI1RDAwMDg3MzA0OUYxODQzMDc5RjUxNEMwODRCNTgwNjg4NEJEQjJcXG46MTAyNUUwMDBDN0JEMzNDMDg0QjU4MDYyODRCREM4QkQyRUMwODA5MTk0XFxuOjEwMjVGMDAwODAwMDgwNjg4MDkzODAwMEQwOTM4OTAwQzA5Mzg4MDAxOVxcbjoxMDI2MDAwMDI0QzA4MDkxODAwMDgwNjI4MDkzODAwMEQwOTM4QjAwRjJcXG46MTAyNjEwMDBDMDkzOEEwMDFBQzA4MDkxQjAwMDgwNjg4MDkzQjAwMDk3XFxuOjEwMjYyMDAwQzA5M0IzMDAxMkMwODA5MUIwMDA4MDYyODA5M0IwMDA2Q1xcbjoxMDI2MzAwMEMwOTNCNDAwMEFDMEMwMzhEMTA1MUNGNDgxMkY2MEUwRkJcXG46MTAyNjQwMDAwMkMwODEyRjYxRTAwRTk0NjgxM0RGOTFDRjkxMUY5MTNBXFxuOjEwMjY1MDAwMDg5NUNGOTNERjkzNDgyRjUwRTBDQTAxODY1NjlGNEZDRFxcbjoxMDI2NjAwMEZDMDEzNDkxNEE1NzVGNEZGQTAxODQ5MTg4MjM2OUYxNDRcXG46MTAyNjcwMDA5MEUwODgwRjk5MUZGQzAxRTg1OUZGNEZBNTkxQjQ5MTk0XFxuOjEwMjY4MDAwRkMwMUVFNThGRjRGQzU5MUQ0OTE2NjIzNTFGNDJGQjc0QVxcbjoxMDI2OTAwMEY4OTQ4QzkxOTMyRjkwOTU4OTIzOEM5Mzg4ODE4OTIzMkFcXG46MTAyNkEwMDAwQkMwNjIzMDYxRjQyRkI3Rjg5NDhDOTE5MzJGOTA5NTAyXFxuOjEwMjZCMDAwODkyMzhDOTM4ODgxODMyQjg4ODMyRkJGMDZDMDlGQjc4M1xcbjoxMDI2QzAwMEY4OTQ4QzkxODMyQjhDOTM5RkJGREY5MUNGOTEwODk1QzlcXG46MTAyNkQwMDA0ODJGNTBFMENBMDE4MjU1OUY0RkZDMDEyNDkxQ0EwMTQ2XFxuOjEwMjZFMDAwODY1NjlGNEZGQzAxOTQ5MTRBNTc1RjRGRkEwMTM0OTFFRlxcbjoxMDI2RjAwMDMzMjMwOUY0NDBDMDIyMjM1MUYxMjMzMDcxRjAyNDMwRjhcXG46MTAyNzAwMDAyOEY0MjEzMEExRjAyMjMwMTFGNTE0QzAyNjMwQjFGMEE4XFxuOjEwMjcxMDAwMjczMEMxRjAyNDMwRDlGNDA0QzA4MDkxODAwMDhGNzczNVxcbjoxMDI3MjAwMDAzQzA4MDkxODAwMDhGN0Q4MDkzODAwMDEwQzA4NEI1QURcXG46MTAyNzMwMDA4Rjc3MDJDMDg0QjU4RjdEODRCRDA5QzA4MDkxQjAwMEMxXFxuOjEwMjc0MDAwOEY3NzAzQzA4MDkxQjAwMDhGN0Q4MDkzQjAwMEUzMkYxRVxcbjoxMDI3NTAwMEYwRTBFRTBGRkYxRkVFNThGRjRGQTU5MUI0OTEyRkI3OTlcXG46MTAyNzYwMDBGODk0NjYyMzIxRjQ4QzkxOTA5NTg5MjMwMkMwOEM5MTcyXFxuOjEwMjc3MDAwODkyQjhDOTMyRkJGMDg5NTA4OTUxRjkyMEY5MjBGQjY0N1xcbjoxMDI3ODAwMDBGOTIxMTI0MkY5MzNGOTM0RjkzOEY5MzlGOTNFRjkzMjdcXG46MTAyNzkwMDBGRjkzODA5MUMwMDA4MkZEMURDMDQwOTFDNjAwMjA5MTMyXFxuOjEwMjdBMDAwRjgwMzMwOTFGOTAzMkY1RjNGNEYyRjczMzA3MDgwOTEwMlxcbjoxMDI3QjAwMEZBMDM5MDkxRkIwMzI4MTczOTA3NzFGMEUwOTFGODAzQjFcXG46MTAyN0MwMDBGMDkxRjkwM0U4NTRGQzRGNDA4MzMwOTNGOTAzMjA5M0QwXFxuOjEwMjdEMDAwRjgwMzAyQzA4MDkxQzYwMEZGOTFFRjkxOUY5MThGOTEwNVxcbjoxMDI3RTAwMDRGOTEzRjkxMkY5MTBGOTAwRkJFMEY5MDFGOTAxODk1MTJcXG46MTAyN0YwMDBFMDkxNEMwNEYwOTE0RDA0RTA1Q0ZGNEY4MTkxOTE5MTg4XFxuOjEwMjgwMDAwMjA4MTMxODE4MDVDOUY0RjgyMUI5MzBCNjBFNDcwRTBEQ1xcbjoxMDI4MTAwMDBFOTQ4NDE2ODkyQjExRjAwRTk0QkMxMzA4OTUxRjkyMDhcXG46MTAyODIwMDAwRjkyMEZCNjBGOTIxMTI0MkY5MzNGOTM4RjkzOUY5Mzg0XFxuOjEwMjgzMDAwRUY5M0ZGOTMyMDkxM0MwNDMwOTEzRDA0ODA5MTNFMDQzRVxcbjoxMDI4NDAwMDkwOTEzRjA0MjgxNzM5MDczMUY0ODA5MUMxMDA4RjdEQTJcXG46MTAyODUwMDA4MDkzQzEwMDE0QzBFMDkxM0UwNEYwOTEzRjA0RTQ1MDI1XFxuOjEwMjg2MDAwRkM0RjIwODE4MDkxM0UwNDkwOTEzRjA0MDE5NjhGNzMyQ1xcbjoxMDI4NzAwMDkwNzA5MDkzM0YwNDgwOTMzRTA0MjA5M0M2MDBGRjkxOTRcXG46MTAyODgwMDBFRjkxOUY5MThGOTEzRjkxMkY5MTBGOTAwRkJFMEY5MEREXFxuOjEwMjg5MDAwMUY5MDE4OTVBRjkyQkY5MkRGOTJFRjkyRkY5MjBGOTMyNVxcbjoxMDI4QTAwMDFGOTNDRjkzREY5M0VDMDE3QTAxOEIwMUREMjQ0MDMwM0RcXG46MTAyOEIwMDA4MUVFNTgwNzgwRTA2ODA3ODBFMDc4MDcxMUYwREQyNDlBXFxuOjEwMjhDMDAwRDM5NDkxRTBBOTJFQjEyQ0VDODlGRDg5REQyMDY5RjAyQlxcbjoxMDI4RDAwMEM1MDEwOEEwMDJDMDg4MEY5OTFGMEE5NEUyRjc4MDgzRkZcXG46MTAyOEUwMDA2MEUwNzlFMDhERTM5MEUwMDVDMDEwODI2MEU4NzRFODc0XFxuOjEwMjhGMDAwOEVFMTkwRTBBODAxOTcwMTBFOTQ5NzE2MjE1MDMwNDA4OFxcbjoxMDI5MDAwMDQwNDA1MDQwNTY5NTQ3OTUzNzk1Mjc5NTgwRTEyMDMwQjdcXG46MTAyOTEwMDAzODA3MjBGMEREMjAxMUYwREQyNEQ2Q0ZFODg5Rjk4OUQxXFxuOjEwMjkyMDAwMzA4M0VBODlGQjg5MjA4MzE5QTJFRTg5RkY4OTQwODFERlxcbjoxMDI5MzAwMDIxRTAzMEUwQzkwMTBDOEMwMkMwODgwRjk5MUYwQTk0NzVcXG46MTAyOTQwMDBFMkY3NDgyQjQwODNFRTg5RkY4OTQwODFDOTAxMEQ4QzU1XFxuOjEwMjk1MDAwMDJDMDg4MEY5OTFGMEE5NEUyRjc0ODJCNDA4M0VFODk0MlxcbjoxMDI5NjAwMEZGODk0MDgxQzkwMTBFOEMwMkMwODgwRjk5MUYwQTk0MEJcXG46MTAyOTcwMDBFMkY3NDgyQjQwODNFRTg5RkY4OTgwODEwRjhDMDJDMEVCXFxuOjEwMjk4MDAwMjIwRjMzMUYwQTk0RTJGNzIwOTUyODIzMjA4M0RGOTEzQVxcbjoxMDI5OTAwMENGOTExRjkxMEY5MUZGOTBFRjkwREY5MEJGOTBBRjkwN0NcXG46MTAyOUEwMDAwODk1REMwMTFDOTZFRDkxRkM5MTFEOTdFMDVDRkY0RkIyXFxuOjEwMjlCMDAwODE5MTkxOTEyMDgxMzE4MTgwNUM5RjRGODIxQjkzMEI4QlxcbjoxMDI5QzAwMDYwRTQ3MEUwMEU5NDg0MTYwODk1REMwMTFDOTZFRDkxOERcXG46MTAyOUQwMDBGQzkxMUQ5N0UwNUNGRjRGMjA4MTMxODFFMDU0RjA0MDc1XFxuOjEwMjlFMDAwREYwMUFFNUJCRjRGOEQ5MTlDOTExMTk3MjgxNzM5MDc3RVxcbjoxMDI5RjAwMDE5RjQyRkVGM0ZFRjA3QzA4RDkxOUM5MUU4MEZGOTFGNURcXG46MTAyQTAwMDA4MDgxMjgyRjMwRTBDOTAxMDg5NURDMDExQzk2RUQ5MUVBXFxuOjEwMkExMDAwRkM5MTFEOTdFMDVDRkY0RjIwODEzMTgxRTA1NEYwNDAzNFxcbjoxMDJBMjAwMERGMDFBRTVCQkY0RjhEOTE5QzkxMTE5NzI4MTczOTA3M0RcXG46MTAyQTMwMDAxOUY0MkZFRjNGRUYxMEMwOEQ5MTlDOTExMTk3RTgwRjgzXFxuOjEwMkE0MDAwRjkxRjIwODE4RDkxOUM5MTExOTcwMTk2OEY3MzkwNzA0MVxcbjoxMDJBNTAwMDExOTY5QzkzOEU5MzMwRTBDOTAxMDg5NURDMDE5MTk2MDRcXG46MTAyQTYwMDA4QzkxOTE5Nzg4MjMzOUYwNTQ5NkVEOTFGQzkxNTU5NzZDXFxuOjEwMkE3MDAwODA4MTg2RkZGOUNGOTE5NjFDOTIwODk1Q0Y5M0RGOTNDMlxcbjoxMDJBODAwMEVDMDFFRTg1RkY4NUUwNUNGRjRGMjA4MTMxODFFMDU0NTFcXG46MTAyQTkwMDBGMDQwMkY1RjNGNEYyRjczMzA3MERGMDFBRTVCQkY0RkIxXFxuOjEwMkFBMDAwOEQ5MTlDOTExMTk3MjgxNzM5MDdEMUYzRTA1Q0ZGNEY2NlxcbjoxMDJBQjAwMDgwODE5MTgxRTA1NEYwNDBFODBGRjkxRjYwODNFRTg1M0FcXG46MTAyQUMwMDBGRjg1RTA1Q0ZGNEYzMTgzMjA4M0VFODlGRjg5MjA4MTAxXFxuOjEwMkFEMDAwODFFMDkwRTAwRjhDMDJDMDg4MEY5OTFGMEE5NEUyRjcwMlxcbjoxMDJBRTAwMDI4MkIyMDgzODFFMDg5QTNFQzg5RkQ4OTgwODE4MDY0ODNcXG46MTAyQUYwMDA4MDgzODFFMDkwRTBERjkxQ0Y5MTA4OTUxMDkyNDMwNEFDXFxuOjEwMkIwMDAwMTA5MjQyMDQ4OEVFOTNFMEEwRTBCMEUwODA5MzQ0MDQ4OVxcbjoxMDJCMTAwMDkwOTM0NTA0QTA5MzQ2MDRCMDkzNDcwNDg0RUQ5MUUwNUNcXG46MTAyQjIwMDA5MDkzNDEwNDgwOTM0MDA0ODhFQjkzRTA5MDkzNEQwNDhDXFxuOjEwMkIzMDAwODA5MzRDMDQ4Q0VGOTNFMDkwOTM0RjA0ODA5MzRFMDQ2OVxcbjoxMDJCNDAwMDg1RUM5MEUwOTA5MzUxMDQ4MDkzNTAwNDg0RUM5MEUwRTVcXG46MTAyQjUwMDA5MDkzNTMwNDgwOTM1MjA0ODBFQzkwRTA5MDkzNTUwNDNBXFxuOjEwMkI2MDAwODA5MzU0MDQ4MUVDOTBFMDkwOTM1NzA0ODA5MzU2MDQzMlxcbjoxMDJCNzAwMDgyRUM5MEUwOTA5MzU5MDQ4MDkzNTgwNDg2RUM5MEUwQTZcXG46MTAyQjgwMDA5MDkzNUIwNDgwOTM1QTA0ODRFMDgwOTM1QzA0ODNFMDE4XFxuOjEwMkI5MDAwODA5MzVEMDQ4N0UwODA5MzVFMDQ4NUUwODA5MzVGMDQwQVxcbjoxMDJCQTAwMDgxRTA4MDkzNjAwNDA4OTUwODk1Q0Y5M0RGOTMwRTk0OURcXG46MTAyQkIwMDA2QzEyMEU5NEQ0MTUwRTk0MzQwM0M4RUZEM0UxMEU5NDI2XFxuOjEwMkJDMDAwNEEwNDIwOTdFMUYzMEU5NEY4MTNGOUNGQ0Y5MkRGOTJFNVxcbjoxMDJCRDAwMEVGOTJGRjkyMEY5MzFGOTNDRjkzREY5MzdDMDE2QjAxRDJcXG46MTAyQkUwMDA4QTAxQzBFMEQwRTAwRkMwRDYwMTZEOTE2RDAxRDcwMTIwXFxuOjEwMkJGMDAwRUQ5MUZDOTEwMTkwRjA4MUUwMkRDNzAxMDk5NUM4MEY3RVxcbjoxMDJDMDAwMEQ5MUYwMTUwMTA0MDAxMTUxMTA1NzFGN0NFMDFERjkxNThcXG46MTAyQzEwMDBDRjkxMUY5MTBGOTFGRjkwRUY5MERGOTBDRjkwMDg5NThCXFxuOjEwMkMyMDAwMkY5MjNGOTI0RjkyNUY5MjZGOTI3RjkyOEY5MjlGOTJEQ1xcbjoxMDJDMzAwMEFGOTJCRjkyQ0Y5MkRGOTJFRjkyRkY5MjBGOTMxRjkzQ0FcXG46MTAyQzQwMDBERjkzQ0Y5M0NEQjdERUI3M0IwMTRDMDExOTAxMkEwMUM5XFxuOjEwMkM1MDAwNkQ4OTdFODk4Rjg5OTg4RDZBMTk3QjA5OEMwOTlEMDlGOFxcbjoxMDJDNjAwMDYyMUE3MzBBODQwQTk1MEFBNDAxOTMwMTBFOTQ1OTE2RjRcXG46MTAyQzcwMDBFMjE4RjMwODA0MDkxNTA5QTgwMTk3MDEwRTk0QjkxNjgyXFxuOjEwMkM4MDAwMkEwRDNCMUQ0QzFENUQxREI5MDFDQTAxQ0Y5MURGOTE3RFxcbjoxMDJDOTAwMDFGOTEwRjkxRkY5MEVGOTBERjkwQ0Y5MEJGOTBBRjkwN0FcXG46MTAyQ0EwMDA5RjkwOEY5MDdGOTA2RjkwNUY5MDRGOTAzRjkwMkY5MDZDXFxuOjEwMkNCMDAwMDg5NTYyOUZEMDAxNzM5RkYwMDE4MjlGRTAwREYxMUQ4NlxcbjoxMDJDQzAwMDY0OUZFMDBERjExRDkyOUZGMDBEODM5RkYwMEQ3NDlGQTZcXG46MTAyQ0QwMDBGMDBENjU5RkYwMEQ5OTI3NzI5RkIwMERFMTFERjkxRjUyXFxuOjEwMkNFMDAwNjM5RkIwMERFMTFERjkxRkJEMDFDRjAxMTEyNDA4OTVBRlxcbjoxMDJDRjAwMDk5MUI3OUUwMDRDMDk5MUY5NjE3MDhGMDk2MUI4ODFGNEVcXG46MTAyRDAwMDA3QTk1QzlGNzgwOTUwODk1OTdGQjA5MkUwNzI2MEFEMDcyXFxuOjEwMkQxMDAwNzdGRDA0RDA0OUQwMDZEMDAwMjAxQUY0NzA5NTYxOTU1M1xcbjoxMDJEMjAwMDdGNEYwODk1RjZGNzkwOTU4MTk1OUY0RjA4OTVBMUUyMDJcXG46MTAyRDMwMDAxQTJFQUExQkJCMUJGRDAxMERDMEFBMUZCQjFGRUUxRjM1XFxuOjEwMkQ0MDAwRkYxRkEyMTdCMzA3RTQwN0Y1MDcyMEYwQTIxQkIzMEI4MFxcbjoxMDJENTAwMEU0MEJGNTBCNjYxRjc3MUY4ODFGOTkxRjFBOTQ2OUY3RkNcXG46MTAyRDYwMDA2MDk1NzA5NTgwOTU5MDk1OUIwMUFDMDFCRDAxQ0YwMTU4XFxuOjEwMkQ3MDAwMDg5NTk3RkIwOTJFMDUyNjBFRDA1N0ZEMDREMEQ3REYwNlxcbjoxMDJEODAwMDBBRDAwMDFDMzhGNDUwOTU0MDk1MzA5NTIxOTUzRjRGNUVcXG46MTAyRDkwMDA0RjRGNUY0RjA4OTVGNkY3OTA5NTgwOTU3MDk1NjE5NTI4XFxuOjEwMkRBMDAwN0Y0RjhGNEY5RjRGMDg5NUFBMUJCQjFCNTFFMTA3QzA1OFxcbjoxMDJEQjAwMEFBMUZCQjFGQTYxN0I3MDcxMEYwQTYxQkI3MEI4ODFGQ0JcXG46MTAyREMwMDA5OTFGNUE5NUE5Rjc4MDk1OTA5NUJDMDFDRDAxMDg5NTVBXFxuOjEwMkREMDAwRUUwRkZGMUYwNTkwRjQ5MUUwMkQwOTk0Rjg5NEZGQ0ZCQVxcbjoxMDJERTAwMDU1NkU2QjZFNkY3NzZFMjA3MDY5NkUyMDZENkY2NDY1QzdcXG46MTAyREYwMDAwMDUzNzQ2MTZFNjQ2MTcyNjQ0NjY5NzI2RDYxNzQ2MURFXFxuOjEwMkUwMDAwMkU2OTZFNkYwMDQ5MzI0MzIwNTI2NTYxNjQyMDQ1NzIxRFxcbjoxMDJFMTAwMDcyNkY3MjNBMjA1NDZGNkYyMDZENjE2RTc5MjA2Mjc5MDNcXG46MTAyRTIwMDA3NDY1NzMyMDcyNjU2MzY1Njk3NjY1NjQwMDQ5MzI0MzMxXFxuOjEwMkUzMDAwMjA1MjY1NjE2NDIwNDU3MjcyNkY3MjNBMjA1NDZGNkY0MFxcbjoxMDJFNDAwMDIwNjY2NTc3MjA2Mjc5NzQ2NTczMjA3MjY1NjM2NTY5QjFcXG46MTAyRTUwMDA3NjY1NjQwMDMxMzAyRDYyNjk3NDIwNjE2NDY0NzI2NTQ2XFxuOjEwMkU2MDAwNzM3MzY5NkU2NzIwNkQ2RjY0NjUyMDY5NzMyMDZFNkY4MFxcbjoxMDJFNzAwMDc0MjA3OTY1NzQyMDczNzU3MDcwNkY3Mjc0NjU2NDAwNjZcXG46MTAyRTgwMDA3NDZGNkYyMDZENjE2RTc5MjA3MTc1NjU3MjY5NjU3M0ZEXFxuOjEwMkU5MDAwMDAyRTYzNzA3MDAwMTMwMEZGODAwMDY2MDQwMDAwMDFDNFxcbjoxMDJFQTAwMDAwMDAwMDAwMEQwQURDMDk5NTA5OUUwOUIzMDlDNDA5NThcXG46MTAyRUIwMDAwMDAwMDAwMDNFMTVFNjE1RDExNDA1MTVFNTE0MkUxNTg5XFxuOjAwMDAwMDAxRkZcIjtcblxudmFyIGhleCA9IGludGVsX2hleC5wYXJzZShkYXRhKS5kYXRhO1xuXG4vL1RPRE8gc3RhbmRhcmRpemUgY2hpcCBjb25maWdzXG4vL3Vub1xudmFyIHBhZ2VTaXplID0gMTI4O1xudmFyIGJhdWQgPSAxMTUyMDA7XG52YXIgZGVsYXkxID0gMTsgLy9taW5pbXVtIGlzIDIuNXVzLCBzbyBhbnl0aGluZyBvdmVyIDEgZmluZT9cbnZhciBkZWxheTIgPSAxO1xuXG52YXIgb3B0aW9ucyA9IHtcbiAgZGV2aWNlY29kZTowLFxuICByZXZpc2lvbjowLFxuICBwcm9ndHlwZTowLFxuICBwYXJtb2RlOjAsXG4gIHBvbGxpbmc6MCxcbiAgc2VsZnRpbWVkOjAsXG4gIGxvY2tieXRlczowLFxuICBmdXNlYnl0ZXM6MCxcbiAgZmxhc2hwb2xsdmFsMTowLFxuICBmbGFzaHBvbGx2YWwyOjAsXG4gIGVlcHJvbXBvbGx2YWwxOjAsXG4gIGVlcHJvbXBvbGx2YWwyOjAsXG4gIHBhZ2VzaXplaGlnaDowLFxuICBwYWdlc2l6ZWxvdzpwYWdlU2l6ZSxcbiAgZWVwcm9tc2l6ZWhpZ2g6MCxcbiAgZWVwcm9tc2l6ZWxvdzowLFxuICBmbGFzaHNpemU0OjAsXG4gIGZsYXNoc2l6ZTM6MCxcbiAgZmxhc2hzaXplMjowLFxuICBmbGFzaHNpemUxOjBcbn07XG5cblxuKGZ1bmN0aW9uKCkge1xuXG5mdW5jdGlvbiB1cGxvYWQoZG9uZSl7XG5cblxuU2VyaWFsUG9ydC5saXN0KGZ1bmN0aW9uIChlcnIsIHBvcnRzKSB7XG4gIHBvcnRzLmZvckVhY2goZnVuY3Rpb24ocG9ydCkge1xuXG4gICAgY29uc29sZS5sb2coXCJmb3VuZCBcIiArIHBvcnQuY29tTmFtZSk7XG5cbiAgICBpZih1c2J0dHlSRS50ZXN0KHBvcnQuY29tTmFtZSkpXG4gICAge1xuXG4gICAgICBjb25zb2xlLmxvZyhcInRyeWluZ1wiICsgcG9ydC5jb21OYW1lKTtcblxuICAgICAgdmFyIHNlcmlhbFBvcnQgPSBuZXcgU2VyaWFsUG9ydC5TZXJpYWxQb3J0KHBvcnQuY29tTmFtZSwge1xuICAgICAgICBiYXVkcmF0ZTogMTE1MjAwLFxuICAgICAgICAvLyBwYXJzZXI6IFNlcmlhbFBvcnQucGFyc2Vycy5yYXdcbiAgICAgIH0sIGZhbHNlKTtcblxuICAgICAgdmFyIHByb2dyYW1tZXIgPSBuZXcgc3RrNTAwKHNlcmlhbFBvcnQpO1xuXG4gICAgICBhc3luYy5zZXJpZXMoW1xuICAgICAgICBwcm9ncmFtbWVyLmNvbm5lY3QuYmluZChwcm9ncmFtbWVyKSxcbiAgICAgICAgcHJvZ3JhbW1lci5yZXNldC5iaW5kKHByb2dyYW1tZXIsZGVsYXkxLCBkZWxheTIpLFxuICAgICAgICBwcm9ncmFtbWVyLnN5bmMuYmluZChwcm9ncmFtbWVyLCA1KSxcbiAgICAgICAgcHJvZ3JhbW1lci5zZXRPcHRpb25zLmJpbmQocHJvZ3JhbW1lciwgb3B0aW9ucyksXG4gICAgICAgIHByb2dyYW1tZXIuZW50ZXJQcm9ncmFtbWluZ01vZGUuYmluZChwcm9ncmFtbWVyKSxcbiAgICAgICAgcHJvZ3JhbW1lci51cGxvYWQuYmluZChwcm9ncmFtbWVyLCBoZXgsIHBhZ2VTaXplKSxcbiAgICAgICAgcHJvZ3JhbW1lci5leGl0UHJvZ3JhbW1pbmdNb2RlLmJpbmQocHJvZ3JhbW1lciksXG4gICAgICAgIHByb2dyYW1tZXIuZGlzY29ubmVjdC5iaW5kKHByb2dyYW1tZXIpXG5cbiAgICAgIF0sIGZ1bmN0aW9uKGVycm9yKXtcbiAgICAgICAgaWYoZXJyb3Ipe1xuICAgICAgICAgIGNvbnNvbGUubG9nKFwicHJvZ3JhbWluZyBGQUlMRUQ6IFwiICsgZXJyb3IpO1xuICAgICAgICB9ZWxzZXtcbiAgICAgICAgICBjb25zb2xlLmxvZyhcInByb2dyYW1pbmcgU1VDQ0VTUyFcIik7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuXG4gICAgfWVsc2V7XG4gICAgICBjb25zb2xlLmxvZyhcInNraXBwaW5nIFwiICsgcG9ydC5jb21OYW1lKTtcbiAgICB9XG5cbiAgfSk7XG59KTtcblxufVxuXG5cbndpbmRvdy5zdGs1MDAgPSB7XG4gIHVwbG9hZDp1cGxvYWRcbn07XG5cblxufSkod2luZG93KTtcbiIsIi8qIVxuICogVGhlIGJ1ZmZlciBtb2R1bGUgZnJvbSBub2RlLmpzLCBmb3IgdGhlIGJyb3dzZXIuXG4gKlxuICogQGF1dGhvciAgIEZlcm9zcyBBYm91a2hhZGlqZWggPGZlcm9zc0BmZXJvc3Mub3JnPiA8aHR0cDovL2Zlcm9zcy5vcmc+XG4gKiBAbGljZW5zZSAgTUlUXG4gKi9cblxudmFyIGJhc2U2NCA9IHJlcXVpcmUoJ2Jhc2U2NC1qcycpXG52YXIgaWVlZTc1NCA9IHJlcXVpcmUoJ2llZWU3NTQnKVxudmFyIGlzQXJyYXkgPSByZXF1aXJlKCdpcy1hcnJheScpXG5cbmV4cG9ydHMuQnVmZmVyID0gQnVmZmVyXG5leHBvcnRzLlNsb3dCdWZmZXIgPSBCdWZmZXJcbmV4cG9ydHMuSU5TUEVDVF9NQVhfQllURVMgPSA1MFxuQnVmZmVyLnBvb2xTaXplID0gODE5MiAvLyBub3QgdXNlZCBieSB0aGlzIGltcGxlbWVudGF0aW9uXG5cbnZhciBrTWF4TGVuZ3RoID0gMHgzZmZmZmZmZlxuXG4vKipcbiAqIElmIGBCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVGA6XG4gKiAgID09PSB0cnVlICAgIFVzZSBVaW50OEFycmF5IGltcGxlbWVudGF0aW9uIChmYXN0ZXN0KVxuICogICA9PT0gZmFsc2UgICBVc2UgT2JqZWN0IGltcGxlbWVudGF0aW9uIChtb3N0IGNvbXBhdGlibGUsIGV2ZW4gSUU2KVxuICpcbiAqIEJyb3dzZXJzIHRoYXQgc3VwcG9ydCB0eXBlZCBhcnJheXMgYXJlIElFIDEwKywgRmlyZWZveCA0KywgQ2hyb21lIDcrLCBTYWZhcmkgNS4xKyxcbiAqIE9wZXJhIDExLjYrLCBpT1MgNC4yKy5cbiAqXG4gKiBOb3RlOlxuICpcbiAqIC0gSW1wbGVtZW50YXRpb24gbXVzdCBzdXBwb3J0IGFkZGluZyBuZXcgcHJvcGVydGllcyB0byBgVWludDhBcnJheWAgaW5zdGFuY2VzLlxuICogICBGaXJlZm94IDQtMjkgbGFja2VkIHN1cHBvcnQsIGZpeGVkIGluIEZpcmVmb3ggMzArLlxuICogICBTZWU6IGh0dHBzOi8vYnVnemlsbGEubW96aWxsYS5vcmcvc2hvd19idWcuY2dpP2lkPTY5NTQzOC5cbiAqXG4gKiAgLSBDaHJvbWUgOS0xMCBpcyBtaXNzaW5nIHRoZSBgVHlwZWRBcnJheS5wcm90b3R5cGUuc3ViYXJyYXlgIGZ1bmN0aW9uLlxuICpcbiAqICAtIElFMTAgaGFzIGEgYnJva2VuIGBUeXBlZEFycmF5LnByb3RvdHlwZS5zdWJhcnJheWAgZnVuY3Rpb24gd2hpY2ggcmV0dXJucyBhcnJheXMgb2ZcbiAqICAgIGluY29ycmVjdCBsZW5ndGggaW4gc29tZSBzaXR1YXRpb25zLlxuICpcbiAqIFdlIGRldGVjdCB0aGVzZSBidWdneSBicm93c2VycyBhbmQgc2V0IGBCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVGAgdG8gYGZhbHNlYCBzbyB0aGV5IHdpbGxcbiAqIGdldCB0aGUgT2JqZWN0IGltcGxlbWVudGF0aW9uLCB3aGljaCBpcyBzbG93ZXIgYnV0IHdpbGwgd29yayBjb3JyZWN0bHkuXG4gKi9cbkJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUID0gKGZ1bmN0aW9uICgpIHtcbiAgdHJ5IHtcbiAgICB2YXIgYnVmID0gbmV3IEFycmF5QnVmZmVyKDApXG4gICAgdmFyIGFyciA9IG5ldyBVaW50OEFycmF5KGJ1ZilcbiAgICBhcnIuZm9vID0gZnVuY3Rpb24gKCkgeyByZXR1cm4gNDIgfVxuICAgIHJldHVybiA0MiA9PT0gYXJyLmZvbygpICYmIC8vIHR5cGVkIGFycmF5IGluc3RhbmNlcyBjYW4gYmUgYXVnbWVudGVkXG4gICAgICAgIHR5cGVvZiBhcnIuc3ViYXJyYXkgPT09ICdmdW5jdGlvbicgJiYgLy8gY2hyb21lIDktMTAgbGFjayBgc3ViYXJyYXlgXG4gICAgICAgIG5ldyBVaW50OEFycmF5KDEpLnN1YmFycmF5KDEsIDEpLmJ5dGVMZW5ndGggPT09IDAgLy8gaWUxMCBoYXMgYnJva2VuIGBzdWJhcnJheWBcbiAgfSBjYXRjaCAoZSkge1xuICAgIHJldHVybiBmYWxzZVxuICB9XG59KSgpXG5cbi8qKlxuICogQ2xhc3M6IEJ1ZmZlclxuICogPT09PT09PT09PT09PVxuICpcbiAqIFRoZSBCdWZmZXIgY29uc3RydWN0b3IgcmV0dXJucyBpbnN0YW5jZXMgb2YgYFVpbnQ4QXJyYXlgIHRoYXQgYXJlIGF1Z21lbnRlZFxuICogd2l0aCBmdW5jdGlvbiBwcm9wZXJ0aWVzIGZvciBhbGwgdGhlIG5vZGUgYEJ1ZmZlcmAgQVBJIGZ1bmN0aW9ucy4gV2UgdXNlXG4gKiBgVWludDhBcnJheWAgc28gdGhhdCBzcXVhcmUgYnJhY2tldCBub3RhdGlvbiB3b3JrcyBhcyBleHBlY3RlZCAtLSBpdCByZXR1cm5zXG4gKiBhIHNpbmdsZSBvY3RldC5cbiAqXG4gKiBCeSBhdWdtZW50aW5nIHRoZSBpbnN0YW5jZXMsIHdlIGNhbiBhdm9pZCBtb2RpZnlpbmcgdGhlIGBVaW50OEFycmF5YFxuICogcHJvdG90eXBlLlxuICovXG5mdW5jdGlvbiBCdWZmZXIgKHN1YmplY3QsIGVuY29kaW5nLCBub1plcm8pIHtcbiAgaWYgKCEodGhpcyBpbnN0YW5jZW9mIEJ1ZmZlcikpXG4gICAgcmV0dXJuIG5ldyBCdWZmZXIoc3ViamVjdCwgZW5jb2RpbmcsIG5vWmVybylcblxuICB2YXIgdHlwZSA9IHR5cGVvZiBzdWJqZWN0XG5cbiAgLy8gRmluZCB0aGUgbGVuZ3RoXG4gIHZhciBsZW5ndGhcbiAgaWYgKHR5cGUgPT09ICdudW1iZXInKVxuICAgIGxlbmd0aCA9IHN1YmplY3QgPiAwID8gc3ViamVjdCA+Pj4gMCA6IDBcbiAgZWxzZSBpZiAodHlwZSA9PT0gJ3N0cmluZycpIHtcbiAgICBpZiAoZW5jb2RpbmcgPT09ICdiYXNlNjQnKVxuICAgICAgc3ViamVjdCA9IGJhc2U2NGNsZWFuKHN1YmplY3QpXG4gICAgbGVuZ3RoID0gQnVmZmVyLmJ5dGVMZW5ndGgoc3ViamVjdCwgZW5jb2RpbmcpXG4gIH0gZWxzZSBpZiAodHlwZSA9PT0gJ29iamVjdCcgJiYgc3ViamVjdCAhPT0gbnVsbCkgeyAvLyBhc3N1bWUgb2JqZWN0IGlzIGFycmF5LWxpa2VcbiAgICBpZiAoc3ViamVjdC50eXBlID09PSAnQnVmZmVyJyAmJiBpc0FycmF5KHN1YmplY3QuZGF0YSkpXG4gICAgICBzdWJqZWN0ID0gc3ViamVjdC5kYXRhXG4gICAgbGVuZ3RoID0gK3N1YmplY3QubGVuZ3RoID4gMCA/IE1hdGguZmxvb3IoK3N1YmplY3QubGVuZ3RoKSA6IDBcbiAgfSBlbHNlXG4gICAgdGhyb3cgbmV3IFR5cGVFcnJvcignbXVzdCBzdGFydCB3aXRoIG51bWJlciwgYnVmZmVyLCBhcnJheSBvciBzdHJpbmcnKVxuXG4gIGlmICh0aGlzLmxlbmd0aCA+IGtNYXhMZW5ndGgpXG4gICAgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ0F0dGVtcHQgdG8gYWxsb2NhdGUgQnVmZmVyIGxhcmdlciB0aGFuIG1heGltdW0gJyArXG4gICAgICAnc2l6ZTogMHgnICsga01heExlbmd0aC50b1N0cmluZygxNikgKyAnIGJ5dGVzJylcblxuICB2YXIgYnVmXG4gIGlmIChCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCkge1xuICAgIC8vIFByZWZlcnJlZDogUmV0dXJuIGFuIGF1Z21lbnRlZCBgVWludDhBcnJheWAgaW5zdGFuY2UgZm9yIGJlc3QgcGVyZm9ybWFuY2VcbiAgICBidWYgPSBCdWZmZXIuX2F1Z21lbnQobmV3IFVpbnQ4QXJyYXkobGVuZ3RoKSlcbiAgfSBlbHNlIHtcbiAgICAvLyBGYWxsYmFjazogUmV0dXJuIFRISVMgaW5zdGFuY2Ugb2YgQnVmZmVyIChjcmVhdGVkIGJ5IGBuZXdgKVxuICAgIGJ1ZiA9IHRoaXNcbiAgICBidWYubGVuZ3RoID0gbGVuZ3RoXG4gICAgYnVmLl9pc0J1ZmZlciA9IHRydWVcbiAgfVxuXG4gIHZhciBpXG4gIGlmIChCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCAmJiB0eXBlb2Ygc3ViamVjdC5ieXRlTGVuZ3RoID09PSAnbnVtYmVyJykge1xuICAgIC8vIFNwZWVkIG9wdGltaXphdGlvbiAtLSB1c2Ugc2V0IGlmIHdlJ3JlIGNvcHlpbmcgZnJvbSBhIHR5cGVkIGFycmF5XG4gICAgYnVmLl9zZXQoc3ViamVjdClcbiAgfSBlbHNlIGlmIChpc0FycmF5aXNoKHN1YmplY3QpKSB7XG4gICAgLy8gVHJlYXQgYXJyYXktaXNoIG9iamVjdHMgYXMgYSBieXRlIGFycmF5XG4gICAgaWYgKEJ1ZmZlci5pc0J1ZmZlcihzdWJqZWN0KSkge1xuICAgICAgZm9yIChpID0gMDsgaSA8IGxlbmd0aDsgaSsrKVxuICAgICAgICBidWZbaV0gPSBzdWJqZWN0LnJlYWRVSW50OChpKVxuICAgIH0gZWxzZSB7XG4gICAgICBmb3IgKGkgPSAwOyBpIDwgbGVuZ3RoOyBpKyspXG4gICAgICAgIGJ1ZltpXSA9ICgoc3ViamVjdFtpXSAlIDI1NikgKyAyNTYpICUgMjU2XG4gICAgfVxuICB9IGVsc2UgaWYgKHR5cGUgPT09ICdzdHJpbmcnKSB7XG4gICAgYnVmLndyaXRlKHN1YmplY3QsIDAsIGVuY29kaW5nKVxuICB9IGVsc2UgaWYgKHR5cGUgPT09ICdudW1iZXInICYmICFCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCAmJiAhbm9aZXJvKSB7XG4gICAgZm9yIChpID0gMDsgaSA8IGxlbmd0aDsgaSsrKSB7XG4gICAgICBidWZbaV0gPSAwXG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIGJ1ZlxufVxuXG5CdWZmZXIuaXNCdWZmZXIgPSBmdW5jdGlvbiAoYikge1xuICByZXR1cm4gISEoYiAhPSBudWxsICYmIGIuX2lzQnVmZmVyKVxufVxuXG5CdWZmZXIuY29tcGFyZSA9IGZ1bmN0aW9uIChhLCBiKSB7XG4gIGlmICghQnVmZmVyLmlzQnVmZmVyKGEpIHx8ICFCdWZmZXIuaXNCdWZmZXIoYikpXG4gICAgdGhyb3cgbmV3IFR5cGVFcnJvcignQXJndW1lbnRzIG11c3QgYmUgQnVmZmVycycpXG5cbiAgdmFyIHggPSBhLmxlbmd0aFxuICB2YXIgeSA9IGIubGVuZ3RoXG4gIGZvciAodmFyIGkgPSAwLCBsZW4gPSBNYXRoLm1pbih4LCB5KTsgaSA8IGxlbiAmJiBhW2ldID09PSBiW2ldOyBpKyspIHt9XG4gIGlmIChpICE9PSBsZW4pIHtcbiAgICB4ID0gYVtpXVxuICAgIHkgPSBiW2ldXG4gIH1cbiAgaWYgKHggPCB5KSByZXR1cm4gLTFcbiAgaWYgKHkgPCB4KSByZXR1cm4gMVxuICByZXR1cm4gMFxufVxuXG5CdWZmZXIuaXNFbmNvZGluZyA9IGZ1bmN0aW9uIChlbmNvZGluZykge1xuICBzd2l0Y2ggKFN0cmluZyhlbmNvZGluZykudG9Mb3dlckNhc2UoKSkge1xuICAgIGNhc2UgJ2hleCc6XG4gICAgY2FzZSAndXRmOCc6XG4gICAgY2FzZSAndXRmLTgnOlxuICAgIGNhc2UgJ2FzY2lpJzpcbiAgICBjYXNlICdiaW5hcnknOlxuICAgIGNhc2UgJ2Jhc2U2NCc6XG4gICAgY2FzZSAncmF3JzpcbiAgICBjYXNlICd1Y3MyJzpcbiAgICBjYXNlICd1Y3MtMic6XG4gICAgY2FzZSAndXRmMTZsZSc6XG4gICAgY2FzZSAndXRmLTE2bGUnOlxuICAgICAgcmV0dXJuIHRydWVcbiAgICBkZWZhdWx0OlxuICAgICAgcmV0dXJuIGZhbHNlXG4gIH1cbn1cblxuQnVmZmVyLmNvbmNhdCA9IGZ1bmN0aW9uIChsaXN0LCB0b3RhbExlbmd0aCkge1xuICBpZiAoIWlzQXJyYXkobGlzdCkpIHRocm93IG5ldyBUeXBlRXJyb3IoJ1VzYWdlOiBCdWZmZXIuY29uY2F0KGxpc3RbLCBsZW5ndGhdKScpXG5cbiAgaWYgKGxpc3QubGVuZ3RoID09PSAwKSB7XG4gICAgcmV0dXJuIG5ldyBCdWZmZXIoMClcbiAgfSBlbHNlIGlmIChsaXN0Lmxlbmd0aCA9PT0gMSkge1xuICAgIHJldHVybiBsaXN0WzBdXG4gIH1cblxuICB2YXIgaVxuICBpZiAodG90YWxMZW5ndGggPT09IHVuZGVmaW5lZCkge1xuICAgIHRvdGFsTGVuZ3RoID0gMFxuICAgIGZvciAoaSA9IDA7IGkgPCBsaXN0Lmxlbmd0aDsgaSsrKSB7XG4gICAgICB0b3RhbExlbmd0aCArPSBsaXN0W2ldLmxlbmd0aFxuICAgIH1cbiAgfVxuXG4gIHZhciBidWYgPSBuZXcgQnVmZmVyKHRvdGFsTGVuZ3RoKVxuICB2YXIgcG9zID0gMFxuICBmb3IgKGkgPSAwOyBpIDwgbGlzdC5sZW5ndGg7IGkrKykge1xuICAgIHZhciBpdGVtID0gbGlzdFtpXVxuICAgIGl0ZW0uY29weShidWYsIHBvcylcbiAgICBwb3MgKz0gaXRlbS5sZW5ndGhcbiAgfVxuICByZXR1cm4gYnVmXG59XG5cbkJ1ZmZlci5ieXRlTGVuZ3RoID0gZnVuY3Rpb24gKHN0ciwgZW5jb2RpbmcpIHtcbiAgdmFyIHJldFxuICBzdHIgPSBzdHIgKyAnJ1xuICBzd2l0Y2ggKGVuY29kaW5nIHx8ICd1dGY4Jykge1xuICAgIGNhc2UgJ2FzY2lpJzpcbiAgICBjYXNlICdiaW5hcnknOlxuICAgIGNhc2UgJ3Jhdyc6XG4gICAgICByZXQgPSBzdHIubGVuZ3RoXG4gICAgICBicmVha1xuICAgIGNhc2UgJ3VjczInOlxuICAgIGNhc2UgJ3Vjcy0yJzpcbiAgICBjYXNlICd1dGYxNmxlJzpcbiAgICBjYXNlICd1dGYtMTZsZSc6XG4gICAgICByZXQgPSBzdHIubGVuZ3RoICogMlxuICAgICAgYnJlYWtcbiAgICBjYXNlICdoZXgnOlxuICAgICAgcmV0ID0gc3RyLmxlbmd0aCA+Pj4gMVxuICAgICAgYnJlYWtcbiAgICBjYXNlICd1dGY4JzpcbiAgICBjYXNlICd1dGYtOCc6XG4gICAgICByZXQgPSB1dGY4VG9CeXRlcyhzdHIpLmxlbmd0aFxuICAgICAgYnJlYWtcbiAgICBjYXNlICdiYXNlNjQnOlxuICAgICAgcmV0ID0gYmFzZTY0VG9CeXRlcyhzdHIpLmxlbmd0aFxuICAgICAgYnJlYWtcbiAgICBkZWZhdWx0OlxuICAgICAgcmV0ID0gc3RyLmxlbmd0aFxuICB9XG4gIHJldHVybiByZXRcbn1cblxuLy8gcHJlLXNldCBmb3IgdmFsdWVzIHRoYXQgbWF5IGV4aXN0IGluIHRoZSBmdXR1cmVcbkJ1ZmZlci5wcm90b3R5cGUubGVuZ3RoID0gdW5kZWZpbmVkXG5CdWZmZXIucHJvdG90eXBlLnBhcmVudCA9IHVuZGVmaW5lZFxuXG4vLyB0b1N0cmluZyhlbmNvZGluZywgc3RhcnQ9MCwgZW5kPWJ1ZmZlci5sZW5ndGgpXG5CdWZmZXIucHJvdG90eXBlLnRvU3RyaW5nID0gZnVuY3Rpb24gKGVuY29kaW5nLCBzdGFydCwgZW5kKSB7XG4gIHZhciBsb3dlcmVkQ2FzZSA9IGZhbHNlXG5cbiAgc3RhcnQgPSBzdGFydCA+Pj4gMFxuICBlbmQgPSBlbmQgPT09IHVuZGVmaW5lZCB8fCBlbmQgPT09IEluZmluaXR5ID8gdGhpcy5sZW5ndGggOiBlbmQgPj4+IDBcblxuICBpZiAoIWVuY29kaW5nKSBlbmNvZGluZyA9ICd1dGY4J1xuICBpZiAoc3RhcnQgPCAwKSBzdGFydCA9IDBcbiAgaWYgKGVuZCA+IHRoaXMubGVuZ3RoKSBlbmQgPSB0aGlzLmxlbmd0aFxuICBpZiAoZW5kIDw9IHN0YXJ0KSByZXR1cm4gJydcblxuICB3aGlsZSAodHJ1ZSkge1xuICAgIHN3aXRjaCAoZW5jb2RpbmcpIHtcbiAgICAgIGNhc2UgJ2hleCc6XG4gICAgICAgIHJldHVybiBoZXhTbGljZSh0aGlzLCBzdGFydCwgZW5kKVxuXG4gICAgICBjYXNlICd1dGY4JzpcbiAgICAgIGNhc2UgJ3V0Zi04JzpcbiAgICAgICAgcmV0dXJuIHV0ZjhTbGljZSh0aGlzLCBzdGFydCwgZW5kKVxuXG4gICAgICBjYXNlICdhc2NpaSc6XG4gICAgICAgIHJldHVybiBhc2NpaVNsaWNlKHRoaXMsIHN0YXJ0LCBlbmQpXG5cbiAgICAgIGNhc2UgJ2JpbmFyeSc6XG4gICAgICAgIHJldHVybiBiaW5hcnlTbGljZSh0aGlzLCBzdGFydCwgZW5kKVxuXG4gICAgICBjYXNlICdiYXNlNjQnOlxuICAgICAgICByZXR1cm4gYmFzZTY0U2xpY2UodGhpcywgc3RhcnQsIGVuZClcblxuICAgICAgY2FzZSAndWNzMic6XG4gICAgICBjYXNlICd1Y3MtMic6XG4gICAgICBjYXNlICd1dGYxNmxlJzpcbiAgICAgIGNhc2UgJ3V0Zi0xNmxlJzpcbiAgICAgICAgcmV0dXJuIHV0ZjE2bGVTbGljZSh0aGlzLCBzdGFydCwgZW5kKVxuXG4gICAgICBkZWZhdWx0OlxuICAgICAgICBpZiAobG93ZXJlZENhc2UpXG4gICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignVW5rbm93biBlbmNvZGluZzogJyArIGVuY29kaW5nKVxuICAgICAgICBlbmNvZGluZyA9IChlbmNvZGluZyArICcnKS50b0xvd2VyQ2FzZSgpXG4gICAgICAgIGxvd2VyZWRDYXNlID0gdHJ1ZVxuICAgIH1cbiAgfVxufVxuXG5CdWZmZXIucHJvdG90eXBlLmVxdWFscyA9IGZ1bmN0aW9uIChiKSB7XG4gIGlmKCFCdWZmZXIuaXNCdWZmZXIoYikpIHRocm93IG5ldyBUeXBlRXJyb3IoJ0FyZ3VtZW50IG11c3QgYmUgYSBCdWZmZXInKVxuICByZXR1cm4gQnVmZmVyLmNvbXBhcmUodGhpcywgYikgPT09IDBcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5pbnNwZWN0ID0gZnVuY3Rpb24gKCkge1xuICB2YXIgc3RyID0gJydcbiAgdmFyIG1heCA9IGV4cG9ydHMuSU5TUEVDVF9NQVhfQllURVNcbiAgaWYgKHRoaXMubGVuZ3RoID4gMCkge1xuICAgIHN0ciA9IHRoaXMudG9TdHJpbmcoJ2hleCcsIDAsIG1heCkubWF0Y2goLy57Mn0vZykuam9pbignICcpXG4gICAgaWYgKHRoaXMubGVuZ3RoID4gbWF4KVxuICAgICAgc3RyICs9ICcgLi4uICdcbiAgfVxuICByZXR1cm4gJzxCdWZmZXIgJyArIHN0ciArICc+J1xufVxuXG5CdWZmZXIucHJvdG90eXBlLmNvbXBhcmUgPSBmdW5jdGlvbiAoYikge1xuICBpZiAoIUJ1ZmZlci5pc0J1ZmZlcihiKSkgdGhyb3cgbmV3IFR5cGVFcnJvcignQXJndW1lbnQgbXVzdCBiZSBhIEJ1ZmZlcicpXG4gIHJldHVybiBCdWZmZXIuY29tcGFyZSh0aGlzLCBiKVxufVxuXG4vLyBgZ2V0YCB3aWxsIGJlIHJlbW92ZWQgaW4gTm9kZSAwLjEzK1xuQnVmZmVyLnByb3RvdHlwZS5nZXQgPSBmdW5jdGlvbiAob2Zmc2V0KSB7XG4gIGNvbnNvbGUubG9nKCcuZ2V0KCkgaXMgZGVwcmVjYXRlZC4gQWNjZXNzIHVzaW5nIGFycmF5IGluZGV4ZXMgaW5zdGVhZC4nKVxuICByZXR1cm4gdGhpcy5yZWFkVUludDgob2Zmc2V0KVxufVxuXG4vLyBgc2V0YCB3aWxsIGJlIHJlbW92ZWQgaW4gTm9kZSAwLjEzK1xuQnVmZmVyLnByb3RvdHlwZS5zZXQgPSBmdW5jdGlvbiAodiwgb2Zmc2V0KSB7XG4gIGNvbnNvbGUubG9nKCcuc2V0KCkgaXMgZGVwcmVjYXRlZC4gQWNjZXNzIHVzaW5nIGFycmF5IGluZGV4ZXMgaW5zdGVhZC4nKVxuICByZXR1cm4gdGhpcy53cml0ZVVJbnQ4KHYsIG9mZnNldClcbn1cblxuZnVuY3Rpb24gaGV4V3JpdGUgKGJ1Ziwgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aCkge1xuICBvZmZzZXQgPSBOdW1iZXIob2Zmc2V0KSB8fCAwXG4gIHZhciByZW1haW5pbmcgPSBidWYubGVuZ3RoIC0gb2Zmc2V0XG4gIGlmICghbGVuZ3RoKSB7XG4gICAgbGVuZ3RoID0gcmVtYWluaW5nXG4gIH0gZWxzZSB7XG4gICAgbGVuZ3RoID0gTnVtYmVyKGxlbmd0aClcbiAgICBpZiAobGVuZ3RoID4gcmVtYWluaW5nKSB7XG4gICAgICBsZW5ndGggPSByZW1haW5pbmdcbiAgICB9XG4gIH1cblxuICAvLyBtdXN0IGJlIGFuIGV2ZW4gbnVtYmVyIG9mIGRpZ2l0c1xuICB2YXIgc3RyTGVuID0gc3RyaW5nLmxlbmd0aFxuICBpZiAoc3RyTGVuICUgMiAhPT0gMCkgdGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIGhleCBzdHJpbmcnKVxuXG4gIGlmIChsZW5ndGggPiBzdHJMZW4gLyAyKSB7XG4gICAgbGVuZ3RoID0gc3RyTGVuIC8gMlxuICB9XG4gIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICB2YXIgYnl0ZSA9IHBhcnNlSW50KHN0cmluZy5zdWJzdHIoaSAqIDIsIDIpLCAxNilcbiAgICBpZiAoaXNOYU4oYnl0ZSkpIHRocm93IG5ldyBFcnJvcignSW52YWxpZCBoZXggc3RyaW5nJylcbiAgICBidWZbb2Zmc2V0ICsgaV0gPSBieXRlXG4gIH1cbiAgcmV0dXJuIGlcbn1cblxuZnVuY3Rpb24gdXRmOFdyaXRlIChidWYsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpIHtcbiAgdmFyIGNoYXJzV3JpdHRlbiA9IGJsaXRCdWZmZXIodXRmOFRvQnl0ZXMoc3RyaW5nKSwgYnVmLCBvZmZzZXQsIGxlbmd0aClcbiAgcmV0dXJuIGNoYXJzV3JpdHRlblxufVxuXG5mdW5jdGlvbiBhc2NpaVdyaXRlIChidWYsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpIHtcbiAgdmFyIGNoYXJzV3JpdHRlbiA9IGJsaXRCdWZmZXIoYXNjaWlUb0J5dGVzKHN0cmluZyksIGJ1Ziwgb2Zmc2V0LCBsZW5ndGgpXG4gIHJldHVybiBjaGFyc1dyaXR0ZW5cbn1cblxuZnVuY3Rpb24gYmluYXJ5V3JpdGUgKGJ1Ziwgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aCkge1xuICByZXR1cm4gYXNjaWlXcml0ZShidWYsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpXG59XG5cbmZ1bmN0aW9uIGJhc2U2NFdyaXRlIChidWYsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpIHtcbiAgdmFyIGNoYXJzV3JpdHRlbiA9IGJsaXRCdWZmZXIoYmFzZTY0VG9CeXRlcyhzdHJpbmcpLCBidWYsIG9mZnNldCwgbGVuZ3RoKVxuICByZXR1cm4gY2hhcnNXcml0dGVuXG59XG5cbmZ1bmN0aW9uIHV0ZjE2bGVXcml0ZSAoYnVmLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKSB7XG4gIHZhciBjaGFyc1dyaXR0ZW4gPSBibGl0QnVmZmVyKHV0ZjE2bGVUb0J5dGVzKHN0cmluZyksIGJ1Ziwgb2Zmc2V0LCBsZW5ndGgpXG4gIHJldHVybiBjaGFyc1dyaXR0ZW5cbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZSA9IGZ1bmN0aW9uIChzdHJpbmcsIG9mZnNldCwgbGVuZ3RoLCBlbmNvZGluZykge1xuICAvLyBTdXBwb3J0IGJvdGggKHN0cmluZywgb2Zmc2V0LCBsZW5ndGgsIGVuY29kaW5nKVxuICAvLyBhbmQgdGhlIGxlZ2FjeSAoc3RyaW5nLCBlbmNvZGluZywgb2Zmc2V0LCBsZW5ndGgpXG4gIGlmIChpc0Zpbml0ZShvZmZzZXQpKSB7XG4gICAgaWYgKCFpc0Zpbml0ZShsZW5ndGgpKSB7XG4gICAgICBlbmNvZGluZyA9IGxlbmd0aFxuICAgICAgbGVuZ3RoID0gdW5kZWZpbmVkXG4gICAgfVxuICB9IGVsc2UgeyAgLy8gbGVnYWN5XG4gICAgdmFyIHN3YXAgPSBlbmNvZGluZ1xuICAgIGVuY29kaW5nID0gb2Zmc2V0XG4gICAgb2Zmc2V0ID0gbGVuZ3RoXG4gICAgbGVuZ3RoID0gc3dhcFxuICB9XG5cbiAgb2Zmc2V0ID0gTnVtYmVyKG9mZnNldCkgfHwgMFxuICB2YXIgcmVtYWluaW5nID0gdGhpcy5sZW5ndGggLSBvZmZzZXRcbiAgaWYgKCFsZW5ndGgpIHtcbiAgICBsZW5ndGggPSByZW1haW5pbmdcbiAgfSBlbHNlIHtcbiAgICBsZW5ndGggPSBOdW1iZXIobGVuZ3RoKVxuICAgIGlmIChsZW5ndGggPiByZW1haW5pbmcpIHtcbiAgICAgIGxlbmd0aCA9IHJlbWFpbmluZ1xuICAgIH1cbiAgfVxuICBlbmNvZGluZyA9IFN0cmluZyhlbmNvZGluZyB8fCAndXRmOCcpLnRvTG93ZXJDYXNlKClcblxuICB2YXIgcmV0XG4gIHN3aXRjaCAoZW5jb2RpbmcpIHtcbiAgICBjYXNlICdoZXgnOlxuICAgICAgcmV0ID0gaGV4V3JpdGUodGhpcywgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aClcbiAgICAgIGJyZWFrXG4gICAgY2FzZSAndXRmOCc6XG4gICAgY2FzZSAndXRmLTgnOlxuICAgICAgcmV0ID0gdXRmOFdyaXRlKHRoaXMsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpXG4gICAgICBicmVha1xuICAgIGNhc2UgJ2FzY2lpJzpcbiAgICAgIHJldCA9IGFzY2lpV3JpdGUodGhpcywgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aClcbiAgICAgIGJyZWFrXG4gICAgY2FzZSAnYmluYXJ5JzpcbiAgICAgIHJldCA9IGJpbmFyeVdyaXRlKHRoaXMsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpXG4gICAgICBicmVha1xuICAgIGNhc2UgJ2Jhc2U2NCc6XG4gICAgICByZXQgPSBiYXNlNjRXcml0ZSh0aGlzLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKVxuICAgICAgYnJlYWtcbiAgICBjYXNlICd1Y3MyJzpcbiAgICBjYXNlICd1Y3MtMic6XG4gICAgY2FzZSAndXRmMTZsZSc6XG4gICAgY2FzZSAndXRmLTE2bGUnOlxuICAgICAgcmV0ID0gdXRmMTZsZVdyaXRlKHRoaXMsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpXG4gICAgICBicmVha1xuICAgIGRlZmF1bHQ6XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdVbmtub3duIGVuY29kaW5nOiAnICsgZW5jb2RpbmcpXG4gIH1cbiAgcmV0dXJuIHJldFxufVxuXG5CdWZmZXIucHJvdG90eXBlLnRvSlNPTiA9IGZ1bmN0aW9uICgpIHtcbiAgcmV0dXJuIHtcbiAgICB0eXBlOiAnQnVmZmVyJyxcbiAgICBkYXRhOiBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbCh0aGlzLl9hcnIgfHwgdGhpcywgMClcbiAgfVxufVxuXG5mdW5jdGlvbiBiYXNlNjRTbGljZSAoYnVmLCBzdGFydCwgZW5kKSB7XG4gIGlmIChzdGFydCA9PT0gMCAmJiBlbmQgPT09IGJ1Zi5sZW5ndGgpIHtcbiAgICByZXR1cm4gYmFzZTY0LmZyb21CeXRlQXJyYXkoYnVmKVxuICB9IGVsc2Uge1xuICAgIHJldHVybiBiYXNlNjQuZnJvbUJ5dGVBcnJheShidWYuc2xpY2Uoc3RhcnQsIGVuZCkpXG4gIH1cbn1cblxuZnVuY3Rpb24gdXRmOFNsaWNlIChidWYsIHN0YXJ0LCBlbmQpIHtcbiAgdmFyIHJlcyA9ICcnXG4gIHZhciB0bXAgPSAnJ1xuICBlbmQgPSBNYXRoLm1pbihidWYubGVuZ3RoLCBlbmQpXG5cbiAgZm9yICh2YXIgaSA9IHN0YXJ0OyBpIDwgZW5kOyBpKyspIHtcbiAgICBpZiAoYnVmW2ldIDw9IDB4N0YpIHtcbiAgICAgIHJlcyArPSBkZWNvZGVVdGY4Q2hhcih0bXApICsgU3RyaW5nLmZyb21DaGFyQ29kZShidWZbaV0pXG4gICAgICB0bXAgPSAnJ1xuICAgIH0gZWxzZSB7XG4gICAgICB0bXAgKz0gJyUnICsgYnVmW2ldLnRvU3RyaW5nKDE2KVxuICAgIH1cbiAgfVxuXG4gIHJldHVybiByZXMgKyBkZWNvZGVVdGY4Q2hhcih0bXApXG59XG5cbmZ1bmN0aW9uIGFzY2lpU2xpY2UgKGJ1Ziwgc3RhcnQsIGVuZCkge1xuICB2YXIgcmV0ID0gJydcbiAgZW5kID0gTWF0aC5taW4oYnVmLmxlbmd0aCwgZW5kKVxuXG4gIGZvciAodmFyIGkgPSBzdGFydDsgaSA8IGVuZDsgaSsrKSB7XG4gICAgcmV0ICs9IFN0cmluZy5mcm9tQ2hhckNvZGUoYnVmW2ldKVxuICB9XG4gIHJldHVybiByZXRcbn1cblxuZnVuY3Rpb24gYmluYXJ5U2xpY2UgKGJ1Ziwgc3RhcnQsIGVuZCkge1xuICByZXR1cm4gYXNjaWlTbGljZShidWYsIHN0YXJ0LCBlbmQpXG59XG5cbmZ1bmN0aW9uIGhleFNsaWNlIChidWYsIHN0YXJ0LCBlbmQpIHtcbiAgdmFyIGxlbiA9IGJ1Zi5sZW5ndGhcblxuICBpZiAoIXN0YXJ0IHx8IHN0YXJ0IDwgMCkgc3RhcnQgPSAwXG4gIGlmICghZW5kIHx8IGVuZCA8IDAgfHwgZW5kID4gbGVuKSBlbmQgPSBsZW5cblxuICB2YXIgb3V0ID0gJydcbiAgZm9yICh2YXIgaSA9IHN0YXJ0OyBpIDwgZW5kOyBpKyspIHtcbiAgICBvdXQgKz0gdG9IZXgoYnVmW2ldKVxuICB9XG4gIHJldHVybiBvdXRcbn1cblxuZnVuY3Rpb24gdXRmMTZsZVNsaWNlIChidWYsIHN0YXJ0LCBlbmQpIHtcbiAgdmFyIGJ5dGVzID0gYnVmLnNsaWNlKHN0YXJ0LCBlbmQpXG4gIHZhciByZXMgPSAnJ1xuICBmb3IgKHZhciBpID0gMDsgaSA8IGJ5dGVzLmxlbmd0aDsgaSArPSAyKSB7XG4gICAgcmVzICs9IFN0cmluZy5mcm9tQ2hhckNvZGUoYnl0ZXNbaV0gKyBieXRlc1tpICsgMV0gKiAyNTYpXG4gIH1cbiAgcmV0dXJuIHJlc1xufVxuXG5CdWZmZXIucHJvdG90eXBlLnNsaWNlID0gZnVuY3Rpb24gKHN0YXJ0LCBlbmQpIHtcbiAgdmFyIGxlbiA9IHRoaXMubGVuZ3RoXG4gIHN0YXJ0ID0gfn5zdGFydFxuICBlbmQgPSBlbmQgPT09IHVuZGVmaW5lZCA/IGxlbiA6IH5+ZW5kXG5cbiAgaWYgKHN0YXJ0IDwgMCkge1xuICAgIHN0YXJ0ICs9IGxlbjtcbiAgICBpZiAoc3RhcnQgPCAwKVxuICAgICAgc3RhcnQgPSAwXG4gIH0gZWxzZSBpZiAoc3RhcnQgPiBsZW4pIHtcbiAgICBzdGFydCA9IGxlblxuICB9XG5cbiAgaWYgKGVuZCA8IDApIHtcbiAgICBlbmQgKz0gbGVuXG4gICAgaWYgKGVuZCA8IDApXG4gICAgICBlbmQgPSAwXG4gIH0gZWxzZSBpZiAoZW5kID4gbGVuKSB7XG4gICAgZW5kID0gbGVuXG4gIH1cblxuICBpZiAoZW5kIDwgc3RhcnQpXG4gICAgZW5kID0gc3RhcnRcblxuICBpZiAoQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHtcbiAgICByZXR1cm4gQnVmZmVyLl9hdWdtZW50KHRoaXMuc3ViYXJyYXkoc3RhcnQsIGVuZCkpXG4gIH0gZWxzZSB7XG4gICAgdmFyIHNsaWNlTGVuID0gZW5kIC0gc3RhcnRcbiAgICB2YXIgbmV3QnVmID0gbmV3IEJ1ZmZlcihzbGljZUxlbiwgdW5kZWZpbmVkLCB0cnVlKVxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgc2xpY2VMZW47IGkrKykge1xuICAgICAgbmV3QnVmW2ldID0gdGhpc1tpICsgc3RhcnRdXG4gICAgfVxuICAgIHJldHVybiBuZXdCdWZcbiAgfVxufVxuXG4vKlxuICogTmVlZCB0byBtYWtlIHN1cmUgdGhhdCBidWZmZXIgaXNuJ3QgdHJ5aW5nIHRvIHdyaXRlIG91dCBvZiBib3VuZHMuXG4gKi9cbmZ1bmN0aW9uIGNoZWNrT2Zmc2V0IChvZmZzZXQsIGV4dCwgbGVuZ3RoKSB7XG4gIGlmICgob2Zmc2V0ICUgMSkgIT09IDAgfHwgb2Zmc2V0IDwgMClcbiAgICB0aHJvdyBuZXcgUmFuZ2VFcnJvcignb2Zmc2V0IGlzIG5vdCB1aW50JylcbiAgaWYgKG9mZnNldCArIGV4dCA+IGxlbmd0aClcbiAgICB0aHJvdyBuZXcgUmFuZ2VFcnJvcignVHJ5aW5nIHRvIGFjY2VzcyBiZXlvbmQgYnVmZmVyIGxlbmd0aCcpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZFVJbnQ4ID0gZnVuY3Rpb24gKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydClcbiAgICBjaGVja09mZnNldChvZmZzZXQsIDEsIHRoaXMubGVuZ3RoKVxuICByZXR1cm4gdGhpc1tvZmZzZXRdXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZFVJbnQxNkxFID0gZnVuY3Rpb24gKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydClcbiAgICBjaGVja09mZnNldChvZmZzZXQsIDIsIHRoaXMubGVuZ3RoKVxuICByZXR1cm4gdGhpc1tvZmZzZXRdIHwgKHRoaXNbb2Zmc2V0ICsgMV0gPDwgOClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkVUludDE2QkUgPSBmdW5jdGlvbiAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KVxuICAgIGNoZWNrT2Zmc2V0KG9mZnNldCwgMiwgdGhpcy5sZW5ndGgpXG4gIHJldHVybiAodGhpc1tvZmZzZXRdIDw8IDgpIHwgdGhpc1tvZmZzZXQgKyAxXVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRVSW50MzJMRSA9IGZ1bmN0aW9uIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpXG4gICAgY2hlY2tPZmZzZXQob2Zmc2V0LCA0LCB0aGlzLmxlbmd0aClcblxuICByZXR1cm4gKCh0aGlzW29mZnNldF0pIHxcbiAgICAgICh0aGlzW29mZnNldCArIDFdIDw8IDgpIHxcbiAgICAgICh0aGlzW29mZnNldCArIDJdIDw8IDE2KSkgK1xuICAgICAgKHRoaXNbb2Zmc2V0ICsgM10gKiAweDEwMDAwMDApXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZFVJbnQzMkJFID0gZnVuY3Rpb24gKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydClcbiAgICBjaGVja09mZnNldChvZmZzZXQsIDQsIHRoaXMubGVuZ3RoKVxuXG4gIHJldHVybiAodGhpc1tvZmZzZXRdICogMHgxMDAwMDAwKSArXG4gICAgICAoKHRoaXNbb2Zmc2V0ICsgMV0gPDwgMTYpIHxcbiAgICAgICh0aGlzW29mZnNldCArIDJdIDw8IDgpIHxcbiAgICAgIHRoaXNbb2Zmc2V0ICsgM10pXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZEludDggPSBmdW5jdGlvbiAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KVxuICAgIGNoZWNrT2Zmc2V0KG9mZnNldCwgMSwgdGhpcy5sZW5ndGgpXG4gIGlmICghKHRoaXNbb2Zmc2V0XSAmIDB4ODApKVxuICAgIHJldHVybiAodGhpc1tvZmZzZXRdKVxuICByZXR1cm4gKCgweGZmIC0gdGhpc1tvZmZzZXRdICsgMSkgKiAtMSlcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkSW50MTZMRSA9IGZ1bmN0aW9uIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpXG4gICAgY2hlY2tPZmZzZXQob2Zmc2V0LCAyLCB0aGlzLmxlbmd0aClcbiAgdmFyIHZhbCA9IHRoaXNbb2Zmc2V0XSB8ICh0aGlzW29mZnNldCArIDFdIDw8IDgpXG4gIHJldHVybiAodmFsICYgMHg4MDAwKSA/IHZhbCB8IDB4RkZGRjAwMDAgOiB2YWxcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkSW50MTZCRSA9IGZ1bmN0aW9uIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpXG4gICAgY2hlY2tPZmZzZXQob2Zmc2V0LCAyLCB0aGlzLmxlbmd0aClcbiAgdmFyIHZhbCA9IHRoaXNbb2Zmc2V0ICsgMV0gfCAodGhpc1tvZmZzZXRdIDw8IDgpXG4gIHJldHVybiAodmFsICYgMHg4MDAwKSA/IHZhbCB8IDB4RkZGRjAwMDAgOiB2YWxcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkSW50MzJMRSA9IGZ1bmN0aW9uIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpXG4gICAgY2hlY2tPZmZzZXQob2Zmc2V0LCA0LCB0aGlzLmxlbmd0aClcblxuICByZXR1cm4gKHRoaXNbb2Zmc2V0XSkgfFxuICAgICAgKHRoaXNbb2Zmc2V0ICsgMV0gPDwgOCkgfFxuICAgICAgKHRoaXNbb2Zmc2V0ICsgMl0gPDwgMTYpIHxcbiAgICAgICh0aGlzW29mZnNldCArIDNdIDw8IDI0KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRJbnQzMkJFID0gZnVuY3Rpb24gKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydClcbiAgICBjaGVja09mZnNldChvZmZzZXQsIDQsIHRoaXMubGVuZ3RoKVxuXG4gIHJldHVybiAodGhpc1tvZmZzZXRdIDw8IDI0KSB8XG4gICAgICAodGhpc1tvZmZzZXQgKyAxXSA8PCAxNikgfFxuICAgICAgKHRoaXNbb2Zmc2V0ICsgMl0gPDwgOCkgfFxuICAgICAgKHRoaXNbb2Zmc2V0ICsgM10pXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZEZsb2F0TEUgPSBmdW5jdGlvbiAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KVxuICAgIGNoZWNrT2Zmc2V0KG9mZnNldCwgNCwgdGhpcy5sZW5ndGgpXG4gIHJldHVybiBpZWVlNzU0LnJlYWQodGhpcywgb2Zmc2V0LCB0cnVlLCAyMywgNClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkRmxvYXRCRSA9IGZ1bmN0aW9uIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpXG4gICAgY2hlY2tPZmZzZXQob2Zmc2V0LCA0LCB0aGlzLmxlbmd0aClcbiAgcmV0dXJuIGllZWU3NTQucmVhZCh0aGlzLCBvZmZzZXQsIGZhbHNlLCAyMywgNClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkRG91YmxlTEUgPSBmdW5jdGlvbiAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KVxuICAgIGNoZWNrT2Zmc2V0KG9mZnNldCwgOCwgdGhpcy5sZW5ndGgpXG4gIHJldHVybiBpZWVlNzU0LnJlYWQodGhpcywgb2Zmc2V0LCB0cnVlLCA1MiwgOClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkRG91YmxlQkUgPSBmdW5jdGlvbiAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KVxuICAgIGNoZWNrT2Zmc2V0KG9mZnNldCwgOCwgdGhpcy5sZW5ndGgpXG4gIHJldHVybiBpZWVlNzU0LnJlYWQodGhpcywgb2Zmc2V0LCBmYWxzZSwgNTIsIDgpXG59XG5cbmZ1bmN0aW9uIGNoZWNrSW50IChidWYsIHZhbHVlLCBvZmZzZXQsIGV4dCwgbWF4LCBtaW4pIHtcbiAgaWYgKCFCdWZmZXIuaXNCdWZmZXIoYnVmKSkgdGhyb3cgbmV3IFR5cGVFcnJvcignYnVmZmVyIG11c3QgYmUgYSBCdWZmZXIgaW5zdGFuY2UnKVxuICBpZiAodmFsdWUgPiBtYXggfHwgdmFsdWUgPCBtaW4pIHRocm93IG5ldyBUeXBlRXJyb3IoJ3ZhbHVlIGlzIG91dCBvZiBib3VuZHMnKVxuICBpZiAob2Zmc2V0ICsgZXh0ID4gYnVmLmxlbmd0aCkgdGhyb3cgbmV3IFR5cGVFcnJvcignaW5kZXggb3V0IG9mIHJhbmdlJylcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZVVJbnQ4ID0gZnVuY3Rpb24gKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCA+Pj4gMFxuICBpZiAoIW5vQXNzZXJ0KVxuICAgIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIDEsIDB4ZmYsIDApXG4gIGlmICghQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHZhbHVlID0gTWF0aC5mbG9vcih2YWx1ZSlcbiAgdGhpc1tvZmZzZXRdID0gdmFsdWVcbiAgcmV0dXJuIG9mZnNldCArIDFcbn1cblxuZnVuY3Rpb24gb2JqZWN0V3JpdGVVSW50MTYgKGJ1ZiwgdmFsdWUsIG9mZnNldCwgbGl0dGxlRW5kaWFuKSB7XG4gIGlmICh2YWx1ZSA8IDApIHZhbHVlID0gMHhmZmZmICsgdmFsdWUgKyAxXG4gIGZvciAodmFyIGkgPSAwLCBqID0gTWF0aC5taW4oYnVmLmxlbmd0aCAtIG9mZnNldCwgMik7IGkgPCBqOyBpKyspIHtcbiAgICBidWZbb2Zmc2V0ICsgaV0gPSAodmFsdWUgJiAoMHhmZiA8PCAoOCAqIChsaXR0bGVFbmRpYW4gPyBpIDogMSAtIGkpKSkpID4+PlxuICAgICAgKGxpdHRsZUVuZGlhbiA/IGkgOiAxIC0gaSkgKiA4XG4gIH1cbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZVVJbnQxNkxFID0gZnVuY3Rpb24gKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCA+Pj4gMFxuICBpZiAoIW5vQXNzZXJ0KVxuICAgIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIDIsIDB4ZmZmZiwgMClcbiAgaWYgKEJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUKSB7XG4gICAgdGhpc1tvZmZzZXRdID0gdmFsdWVcbiAgICB0aGlzW29mZnNldCArIDFdID0gKHZhbHVlID4+PiA4KVxuICB9IGVsc2Ugb2JqZWN0V3JpdGVVSW50MTYodGhpcywgdmFsdWUsIG9mZnNldCwgdHJ1ZSlcbiAgcmV0dXJuIG9mZnNldCArIDJcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZVVJbnQxNkJFID0gZnVuY3Rpb24gKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCA+Pj4gMFxuICBpZiAoIW5vQXNzZXJ0KVxuICAgIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIDIsIDB4ZmZmZiwgMClcbiAgaWYgKEJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUKSB7XG4gICAgdGhpc1tvZmZzZXRdID0gKHZhbHVlID4+PiA4KVxuICAgIHRoaXNbb2Zmc2V0ICsgMV0gPSB2YWx1ZVxuICB9IGVsc2Ugb2JqZWN0V3JpdGVVSW50MTYodGhpcywgdmFsdWUsIG9mZnNldCwgZmFsc2UpXG4gIHJldHVybiBvZmZzZXQgKyAyXG59XG5cbmZ1bmN0aW9uIG9iamVjdFdyaXRlVUludDMyIChidWYsIHZhbHVlLCBvZmZzZXQsIGxpdHRsZUVuZGlhbikge1xuICBpZiAodmFsdWUgPCAwKSB2YWx1ZSA9IDB4ZmZmZmZmZmYgKyB2YWx1ZSArIDFcbiAgZm9yICh2YXIgaSA9IDAsIGogPSBNYXRoLm1pbihidWYubGVuZ3RoIC0gb2Zmc2V0LCA0KTsgaSA8IGo7IGkrKykge1xuICAgIGJ1ZltvZmZzZXQgKyBpXSA9ICh2YWx1ZSA+Pj4gKGxpdHRsZUVuZGlhbiA/IGkgOiAzIC0gaSkgKiA4KSAmIDB4ZmZcbiAgfVxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlVUludDMyTEUgPSBmdW5jdGlvbiAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0ID4+PiAwXG4gIGlmICghbm9Bc3NlcnQpXG4gICAgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgNCwgMHhmZmZmZmZmZiwgMClcbiAgaWYgKEJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUKSB7XG4gICAgdGhpc1tvZmZzZXQgKyAzXSA9ICh2YWx1ZSA+Pj4gMjQpXG4gICAgdGhpc1tvZmZzZXQgKyAyXSA9ICh2YWx1ZSA+Pj4gMTYpXG4gICAgdGhpc1tvZmZzZXQgKyAxXSA9ICh2YWx1ZSA+Pj4gOClcbiAgICB0aGlzW29mZnNldF0gPSB2YWx1ZVxuICB9IGVsc2Ugb2JqZWN0V3JpdGVVSW50MzIodGhpcywgdmFsdWUsIG9mZnNldCwgdHJ1ZSlcbiAgcmV0dXJuIG9mZnNldCArIDRcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZVVJbnQzMkJFID0gZnVuY3Rpb24gKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCA+Pj4gMFxuICBpZiAoIW5vQXNzZXJ0KVxuICAgIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIDQsIDB4ZmZmZmZmZmYsIDApXG4gIGlmIChCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCkge1xuICAgIHRoaXNbb2Zmc2V0XSA9ICh2YWx1ZSA+Pj4gMjQpXG4gICAgdGhpc1tvZmZzZXQgKyAxXSA9ICh2YWx1ZSA+Pj4gMTYpXG4gICAgdGhpc1tvZmZzZXQgKyAyXSA9ICh2YWx1ZSA+Pj4gOClcbiAgICB0aGlzW29mZnNldCArIDNdID0gdmFsdWVcbiAgfSBlbHNlIG9iamVjdFdyaXRlVUludDMyKHRoaXMsIHZhbHVlLCBvZmZzZXQsIGZhbHNlKVxuICByZXR1cm4gb2Zmc2V0ICsgNFxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlSW50OCA9IGZ1bmN0aW9uICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICB2YWx1ZSA9ICt2YWx1ZVxuICBvZmZzZXQgPSBvZmZzZXQgPj4+IDBcbiAgaWYgKCFub0Fzc2VydClcbiAgICBjaGVja0ludCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCAxLCAweDdmLCAtMHg4MClcbiAgaWYgKCFCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCkgdmFsdWUgPSBNYXRoLmZsb29yKHZhbHVlKVxuICBpZiAodmFsdWUgPCAwKSB2YWx1ZSA9IDB4ZmYgKyB2YWx1ZSArIDFcbiAgdGhpc1tvZmZzZXRdID0gdmFsdWVcbiAgcmV0dXJuIG9mZnNldCArIDFcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZUludDE2TEUgPSBmdW5jdGlvbiAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0ID4+PiAwXG4gIGlmICghbm9Bc3NlcnQpXG4gICAgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgMiwgMHg3ZmZmLCAtMHg4MDAwKVxuICBpZiAoQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHtcbiAgICB0aGlzW29mZnNldF0gPSB2YWx1ZVxuICAgIHRoaXNbb2Zmc2V0ICsgMV0gPSAodmFsdWUgPj4+IDgpXG4gIH0gZWxzZSBvYmplY3RXcml0ZVVJbnQxNih0aGlzLCB2YWx1ZSwgb2Zmc2V0LCB0cnVlKVxuICByZXR1cm4gb2Zmc2V0ICsgMlxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlSW50MTZCRSA9IGZ1bmN0aW9uICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICB2YWx1ZSA9ICt2YWx1ZVxuICBvZmZzZXQgPSBvZmZzZXQgPj4+IDBcbiAgaWYgKCFub0Fzc2VydClcbiAgICBjaGVja0ludCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCAyLCAweDdmZmYsIC0weDgwMDApXG4gIGlmIChCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCkge1xuICAgIHRoaXNbb2Zmc2V0XSA9ICh2YWx1ZSA+Pj4gOClcbiAgICB0aGlzW29mZnNldCArIDFdID0gdmFsdWVcbiAgfSBlbHNlIG9iamVjdFdyaXRlVUludDE2KHRoaXMsIHZhbHVlLCBvZmZzZXQsIGZhbHNlKVxuICByZXR1cm4gb2Zmc2V0ICsgMlxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlSW50MzJMRSA9IGZ1bmN0aW9uICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICB2YWx1ZSA9ICt2YWx1ZVxuICBvZmZzZXQgPSBvZmZzZXQgPj4+IDBcbiAgaWYgKCFub0Fzc2VydClcbiAgICBjaGVja0ludCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCA0LCAweDdmZmZmZmZmLCAtMHg4MDAwMDAwMClcbiAgaWYgKEJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUKSB7XG4gICAgdGhpc1tvZmZzZXRdID0gdmFsdWVcbiAgICB0aGlzW29mZnNldCArIDFdID0gKHZhbHVlID4+PiA4KVxuICAgIHRoaXNbb2Zmc2V0ICsgMl0gPSAodmFsdWUgPj4+IDE2KVxuICAgIHRoaXNbb2Zmc2V0ICsgM10gPSAodmFsdWUgPj4+IDI0KVxuICB9IGVsc2Ugb2JqZWN0V3JpdGVVSW50MzIodGhpcywgdmFsdWUsIG9mZnNldCwgdHJ1ZSlcbiAgcmV0dXJuIG9mZnNldCArIDRcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZUludDMyQkUgPSBmdW5jdGlvbiAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0ID4+PiAwXG4gIGlmICghbm9Bc3NlcnQpXG4gICAgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgNCwgMHg3ZmZmZmZmZiwgLTB4ODAwMDAwMDApXG4gIGlmICh2YWx1ZSA8IDApIHZhbHVlID0gMHhmZmZmZmZmZiArIHZhbHVlICsgMVxuICBpZiAoQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHtcbiAgICB0aGlzW29mZnNldF0gPSAodmFsdWUgPj4+IDI0KVxuICAgIHRoaXNbb2Zmc2V0ICsgMV0gPSAodmFsdWUgPj4+IDE2KVxuICAgIHRoaXNbb2Zmc2V0ICsgMl0gPSAodmFsdWUgPj4+IDgpXG4gICAgdGhpc1tvZmZzZXQgKyAzXSA9IHZhbHVlXG4gIH0gZWxzZSBvYmplY3RXcml0ZVVJbnQzMih0aGlzLCB2YWx1ZSwgb2Zmc2V0LCBmYWxzZSlcbiAgcmV0dXJuIG9mZnNldCArIDRcbn1cblxuZnVuY3Rpb24gY2hlY2tJRUVFNzU0IChidWYsIHZhbHVlLCBvZmZzZXQsIGV4dCwgbWF4LCBtaW4pIHtcbiAgaWYgKHZhbHVlID4gbWF4IHx8IHZhbHVlIDwgbWluKSB0aHJvdyBuZXcgVHlwZUVycm9yKCd2YWx1ZSBpcyBvdXQgb2YgYm91bmRzJylcbiAgaWYgKG9mZnNldCArIGV4dCA+IGJ1Zi5sZW5ndGgpIHRocm93IG5ldyBUeXBlRXJyb3IoJ2luZGV4IG91dCBvZiByYW5nZScpXG59XG5cbmZ1bmN0aW9uIHdyaXRlRmxvYXQgKGJ1ZiwgdmFsdWUsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KVxuICAgIGNoZWNrSUVFRTc1NChidWYsIHZhbHVlLCBvZmZzZXQsIDQsIDMuNDAyODIzNDY2Mzg1Mjg4NmUrMzgsIC0zLjQwMjgyMzQ2NjM4NTI4ODZlKzM4KVxuICBpZWVlNzU0LndyaXRlKGJ1ZiwgdmFsdWUsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCAyMywgNClcbiAgcmV0dXJuIG9mZnNldCArIDRcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZUZsb2F0TEUgPSBmdW5jdGlvbiAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgcmV0dXJuIHdyaXRlRmxvYXQodGhpcywgdmFsdWUsIG9mZnNldCwgdHJ1ZSwgbm9Bc3NlcnQpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVGbG9hdEJFID0gZnVuY3Rpb24gKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHJldHVybiB3cml0ZUZsb2F0KHRoaXMsIHZhbHVlLCBvZmZzZXQsIGZhbHNlLCBub0Fzc2VydClcbn1cblxuZnVuY3Rpb24gd3JpdGVEb3VibGUgKGJ1ZiwgdmFsdWUsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KVxuICAgIGNoZWNrSUVFRTc1NChidWYsIHZhbHVlLCBvZmZzZXQsIDgsIDEuNzk3NjkzMTM0ODYyMzE1N0UrMzA4LCAtMS43OTc2OTMxMzQ4NjIzMTU3RSszMDgpXG4gIGllZWU3NTQud3JpdGUoYnVmLCB2YWx1ZSwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4sIDUyLCA4KVxuICByZXR1cm4gb2Zmc2V0ICsgOFxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlRG91YmxlTEUgPSBmdW5jdGlvbiAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgcmV0dXJuIHdyaXRlRG91YmxlKHRoaXMsIHZhbHVlLCBvZmZzZXQsIHRydWUsIG5vQXNzZXJ0KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlRG91YmxlQkUgPSBmdW5jdGlvbiAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgcmV0dXJuIHdyaXRlRG91YmxlKHRoaXMsIHZhbHVlLCBvZmZzZXQsIGZhbHNlLCBub0Fzc2VydClcbn1cblxuLy8gY29weSh0YXJnZXRCdWZmZXIsIHRhcmdldFN0YXJ0PTAsIHNvdXJjZVN0YXJ0PTAsIHNvdXJjZUVuZD1idWZmZXIubGVuZ3RoKVxuQnVmZmVyLnByb3RvdHlwZS5jb3B5ID0gZnVuY3Rpb24gKHRhcmdldCwgdGFyZ2V0X3N0YXJ0LCBzdGFydCwgZW5kKSB7XG4gIHZhciBzb3VyY2UgPSB0aGlzXG5cbiAgaWYgKCFzdGFydCkgc3RhcnQgPSAwXG4gIGlmICghZW5kICYmIGVuZCAhPT0gMCkgZW5kID0gdGhpcy5sZW5ndGhcbiAgaWYgKCF0YXJnZXRfc3RhcnQpIHRhcmdldF9zdGFydCA9IDBcblxuICAvLyBDb3B5IDAgYnl0ZXM7IHdlJ3JlIGRvbmVcbiAgaWYgKGVuZCA9PT0gc3RhcnQpIHJldHVyblxuICBpZiAodGFyZ2V0Lmxlbmd0aCA9PT0gMCB8fCBzb3VyY2UubGVuZ3RoID09PSAwKSByZXR1cm5cblxuICAvLyBGYXRhbCBlcnJvciBjb25kaXRpb25zXG4gIGlmIChlbmQgPCBzdGFydCkgdGhyb3cgbmV3IFR5cGVFcnJvcignc291cmNlRW5kIDwgc291cmNlU3RhcnQnKVxuICBpZiAodGFyZ2V0X3N0YXJ0IDwgMCB8fCB0YXJnZXRfc3RhcnQgPj0gdGFyZ2V0Lmxlbmd0aClcbiAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCd0YXJnZXRTdGFydCBvdXQgb2YgYm91bmRzJylcbiAgaWYgKHN0YXJ0IDwgMCB8fCBzdGFydCA+PSBzb3VyY2UubGVuZ3RoKSB0aHJvdyBuZXcgVHlwZUVycm9yKCdzb3VyY2VTdGFydCBvdXQgb2YgYm91bmRzJylcbiAgaWYgKGVuZCA8IDAgfHwgZW5kID4gc291cmNlLmxlbmd0aCkgdGhyb3cgbmV3IFR5cGVFcnJvcignc291cmNlRW5kIG91dCBvZiBib3VuZHMnKVxuXG4gIC8vIEFyZSB3ZSBvb2I/XG4gIGlmIChlbmQgPiB0aGlzLmxlbmd0aClcbiAgICBlbmQgPSB0aGlzLmxlbmd0aFxuICBpZiAodGFyZ2V0Lmxlbmd0aCAtIHRhcmdldF9zdGFydCA8IGVuZCAtIHN0YXJ0KVxuICAgIGVuZCA9IHRhcmdldC5sZW5ndGggLSB0YXJnZXRfc3RhcnQgKyBzdGFydFxuXG4gIHZhciBsZW4gPSBlbmQgLSBzdGFydFxuXG4gIGlmIChsZW4gPCAxMDAwIHx8ICFCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCkge1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgIHRhcmdldFtpICsgdGFyZ2V0X3N0YXJ0XSA9IHRoaXNbaSArIHN0YXJ0XVxuICAgIH1cbiAgfSBlbHNlIHtcbiAgICB0YXJnZXQuX3NldCh0aGlzLnN1YmFycmF5KHN0YXJ0LCBzdGFydCArIGxlbiksIHRhcmdldF9zdGFydClcbiAgfVxufVxuXG4vLyBmaWxsKHZhbHVlLCBzdGFydD0wLCBlbmQ9YnVmZmVyLmxlbmd0aClcbkJ1ZmZlci5wcm90b3R5cGUuZmlsbCA9IGZ1bmN0aW9uICh2YWx1ZSwgc3RhcnQsIGVuZCkge1xuICBpZiAoIXZhbHVlKSB2YWx1ZSA9IDBcbiAgaWYgKCFzdGFydCkgc3RhcnQgPSAwXG4gIGlmICghZW5kKSBlbmQgPSB0aGlzLmxlbmd0aFxuXG4gIGlmIChlbmQgPCBzdGFydCkgdGhyb3cgbmV3IFR5cGVFcnJvcignZW5kIDwgc3RhcnQnKVxuXG4gIC8vIEZpbGwgMCBieXRlczsgd2UncmUgZG9uZVxuICBpZiAoZW5kID09PSBzdGFydCkgcmV0dXJuXG4gIGlmICh0aGlzLmxlbmd0aCA9PT0gMCkgcmV0dXJuXG5cbiAgaWYgKHN0YXJ0IDwgMCB8fCBzdGFydCA+PSB0aGlzLmxlbmd0aCkgdGhyb3cgbmV3IFR5cGVFcnJvcignc3RhcnQgb3V0IG9mIGJvdW5kcycpXG4gIGlmIChlbmQgPCAwIHx8IGVuZCA+IHRoaXMubGVuZ3RoKSB0aHJvdyBuZXcgVHlwZUVycm9yKCdlbmQgb3V0IG9mIGJvdW5kcycpXG5cbiAgdmFyIGlcbiAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ251bWJlcicpIHtcbiAgICBmb3IgKGkgPSBzdGFydDsgaSA8IGVuZDsgaSsrKSB7XG4gICAgICB0aGlzW2ldID0gdmFsdWVcbiAgICB9XG4gIH0gZWxzZSB7XG4gICAgdmFyIGJ5dGVzID0gdXRmOFRvQnl0ZXModmFsdWUudG9TdHJpbmcoKSlcbiAgICB2YXIgbGVuID0gYnl0ZXMubGVuZ3RoXG4gICAgZm9yIChpID0gc3RhcnQ7IGkgPCBlbmQ7IGkrKykge1xuICAgICAgdGhpc1tpXSA9IGJ5dGVzW2kgJSBsZW5dXG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHRoaXNcbn1cblxuLyoqXG4gKiBDcmVhdGVzIGEgbmV3IGBBcnJheUJ1ZmZlcmAgd2l0aCB0aGUgKmNvcGllZCogbWVtb3J5IG9mIHRoZSBidWZmZXIgaW5zdGFuY2UuXG4gKiBBZGRlZCBpbiBOb2RlIDAuMTIuIE9ubHkgYXZhaWxhYmxlIGluIGJyb3dzZXJzIHRoYXQgc3VwcG9ydCBBcnJheUJ1ZmZlci5cbiAqL1xuQnVmZmVyLnByb3RvdHlwZS50b0FycmF5QnVmZmVyID0gZnVuY3Rpb24gKCkge1xuICBpZiAodHlwZW9mIFVpbnQ4QXJyYXkgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgaWYgKEJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUKSB7XG4gICAgICByZXR1cm4gKG5ldyBCdWZmZXIodGhpcykpLmJ1ZmZlclxuICAgIH0gZWxzZSB7XG4gICAgICB2YXIgYnVmID0gbmV3IFVpbnQ4QXJyYXkodGhpcy5sZW5ndGgpXG4gICAgICBmb3IgKHZhciBpID0gMCwgbGVuID0gYnVmLmxlbmd0aDsgaSA8IGxlbjsgaSArPSAxKSB7XG4gICAgICAgIGJ1ZltpXSA9IHRoaXNbaV1cbiAgICAgIH1cbiAgICAgIHJldHVybiBidWYuYnVmZmVyXG4gICAgfVxuICB9IGVsc2Uge1xuICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ0J1ZmZlci50b0FycmF5QnVmZmVyIG5vdCBzdXBwb3J0ZWQgaW4gdGhpcyBicm93c2VyJylcbiAgfVxufVxuXG4vLyBIRUxQRVIgRlVOQ1RJT05TXG4vLyA9PT09PT09PT09PT09PT09XG5cbnZhciBCUCA9IEJ1ZmZlci5wcm90b3R5cGVcblxuLyoqXG4gKiBBdWdtZW50IGEgVWludDhBcnJheSAqaW5zdGFuY2UqIChub3QgdGhlIFVpbnQ4QXJyYXkgY2xhc3MhKSB3aXRoIEJ1ZmZlciBtZXRob2RzXG4gKi9cbkJ1ZmZlci5fYXVnbWVudCA9IGZ1bmN0aW9uIChhcnIpIHtcbiAgYXJyLmNvbnN0cnVjdG9yID0gQnVmZmVyXG4gIGFyci5faXNCdWZmZXIgPSB0cnVlXG5cbiAgLy8gc2F2ZSByZWZlcmVuY2UgdG8gb3JpZ2luYWwgVWludDhBcnJheSBnZXQvc2V0IG1ldGhvZHMgYmVmb3JlIG92ZXJ3cml0aW5nXG4gIGFyci5fZ2V0ID0gYXJyLmdldFxuICBhcnIuX3NldCA9IGFyci5zZXRcblxuICAvLyBkZXByZWNhdGVkLCB3aWxsIGJlIHJlbW92ZWQgaW4gbm9kZSAwLjEzK1xuICBhcnIuZ2V0ID0gQlAuZ2V0XG4gIGFyci5zZXQgPSBCUC5zZXRcblxuICBhcnIud3JpdGUgPSBCUC53cml0ZVxuICBhcnIudG9TdHJpbmcgPSBCUC50b1N0cmluZ1xuICBhcnIudG9Mb2NhbGVTdHJpbmcgPSBCUC50b1N0cmluZ1xuICBhcnIudG9KU09OID0gQlAudG9KU09OXG4gIGFyci5lcXVhbHMgPSBCUC5lcXVhbHNcbiAgYXJyLmNvbXBhcmUgPSBCUC5jb21wYXJlXG4gIGFyci5jb3B5ID0gQlAuY29weVxuICBhcnIuc2xpY2UgPSBCUC5zbGljZVxuICBhcnIucmVhZFVJbnQ4ID0gQlAucmVhZFVJbnQ4XG4gIGFyci5yZWFkVUludDE2TEUgPSBCUC5yZWFkVUludDE2TEVcbiAgYXJyLnJlYWRVSW50MTZCRSA9IEJQLnJlYWRVSW50MTZCRVxuICBhcnIucmVhZFVJbnQzMkxFID0gQlAucmVhZFVJbnQzMkxFXG4gIGFyci5yZWFkVUludDMyQkUgPSBCUC5yZWFkVUludDMyQkVcbiAgYXJyLnJlYWRJbnQ4ID0gQlAucmVhZEludDhcbiAgYXJyLnJlYWRJbnQxNkxFID0gQlAucmVhZEludDE2TEVcbiAgYXJyLnJlYWRJbnQxNkJFID0gQlAucmVhZEludDE2QkVcbiAgYXJyLnJlYWRJbnQzMkxFID0gQlAucmVhZEludDMyTEVcbiAgYXJyLnJlYWRJbnQzMkJFID0gQlAucmVhZEludDMyQkVcbiAgYXJyLnJlYWRGbG9hdExFID0gQlAucmVhZEZsb2F0TEVcbiAgYXJyLnJlYWRGbG9hdEJFID0gQlAucmVhZEZsb2F0QkVcbiAgYXJyLnJlYWREb3VibGVMRSA9IEJQLnJlYWREb3VibGVMRVxuICBhcnIucmVhZERvdWJsZUJFID0gQlAucmVhZERvdWJsZUJFXG4gIGFyci53cml0ZVVJbnQ4ID0gQlAud3JpdGVVSW50OFxuICBhcnIud3JpdGVVSW50MTZMRSA9IEJQLndyaXRlVUludDE2TEVcbiAgYXJyLndyaXRlVUludDE2QkUgPSBCUC53cml0ZVVJbnQxNkJFXG4gIGFyci53cml0ZVVJbnQzMkxFID0gQlAud3JpdGVVSW50MzJMRVxuICBhcnIud3JpdGVVSW50MzJCRSA9IEJQLndyaXRlVUludDMyQkVcbiAgYXJyLndyaXRlSW50OCA9IEJQLndyaXRlSW50OFxuICBhcnIud3JpdGVJbnQxNkxFID0gQlAud3JpdGVJbnQxNkxFXG4gIGFyci53cml0ZUludDE2QkUgPSBCUC53cml0ZUludDE2QkVcbiAgYXJyLndyaXRlSW50MzJMRSA9IEJQLndyaXRlSW50MzJMRVxuICBhcnIud3JpdGVJbnQzMkJFID0gQlAud3JpdGVJbnQzMkJFXG4gIGFyci53cml0ZUZsb2F0TEUgPSBCUC53cml0ZUZsb2F0TEVcbiAgYXJyLndyaXRlRmxvYXRCRSA9IEJQLndyaXRlRmxvYXRCRVxuICBhcnIud3JpdGVEb3VibGVMRSA9IEJQLndyaXRlRG91YmxlTEVcbiAgYXJyLndyaXRlRG91YmxlQkUgPSBCUC53cml0ZURvdWJsZUJFXG4gIGFyci5maWxsID0gQlAuZmlsbFxuICBhcnIuaW5zcGVjdCA9IEJQLmluc3BlY3RcbiAgYXJyLnRvQXJyYXlCdWZmZXIgPSBCUC50b0FycmF5QnVmZmVyXG5cbiAgcmV0dXJuIGFyclxufVxuXG52YXIgSU5WQUxJRF9CQVNFNjRfUkUgPSAvW14rXFwvMC05QS16XS9nXG5cbmZ1bmN0aW9uIGJhc2U2NGNsZWFuIChzdHIpIHtcbiAgLy8gTm9kZSBzdHJpcHMgb3V0IGludmFsaWQgY2hhcmFjdGVycyBsaWtlIFxcbiBhbmQgXFx0IGZyb20gdGhlIHN0cmluZywgYmFzZTY0LWpzIGRvZXMgbm90XG4gIHN0ciA9IHN0cmluZ3RyaW0oc3RyKS5yZXBsYWNlKElOVkFMSURfQkFTRTY0X1JFLCAnJylcbiAgLy8gTm9kZSBhbGxvd3MgZm9yIG5vbi1wYWRkZWQgYmFzZTY0IHN0cmluZ3MgKG1pc3NpbmcgdHJhaWxpbmcgPT09KSwgYmFzZTY0LWpzIGRvZXMgbm90XG4gIHdoaWxlIChzdHIubGVuZ3RoICUgNCAhPT0gMCkge1xuICAgIHN0ciA9IHN0ciArICc9J1xuICB9XG4gIHJldHVybiBzdHJcbn1cblxuZnVuY3Rpb24gc3RyaW5ndHJpbSAoc3RyKSB7XG4gIGlmIChzdHIudHJpbSkgcmV0dXJuIHN0ci50cmltKClcbiAgcmV0dXJuIHN0ci5yZXBsYWNlKC9eXFxzK3xcXHMrJC9nLCAnJylcbn1cblxuZnVuY3Rpb24gaXNBcnJheWlzaCAoc3ViamVjdCkge1xuICByZXR1cm4gaXNBcnJheShzdWJqZWN0KSB8fCBCdWZmZXIuaXNCdWZmZXIoc3ViamVjdCkgfHxcbiAgICAgIHN1YmplY3QgJiYgdHlwZW9mIHN1YmplY3QgPT09ICdvYmplY3QnICYmXG4gICAgICB0eXBlb2Ygc3ViamVjdC5sZW5ndGggPT09ICdudW1iZXInXG59XG5cbmZ1bmN0aW9uIHRvSGV4IChuKSB7XG4gIGlmIChuIDwgMTYpIHJldHVybiAnMCcgKyBuLnRvU3RyaW5nKDE2KVxuICByZXR1cm4gbi50b1N0cmluZygxNilcbn1cblxuZnVuY3Rpb24gdXRmOFRvQnl0ZXMgKHN0cikge1xuICB2YXIgYnl0ZUFycmF5ID0gW11cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBzdHIubGVuZ3RoOyBpKyspIHtcbiAgICB2YXIgYiA9IHN0ci5jaGFyQ29kZUF0KGkpXG4gICAgaWYgKGIgPD0gMHg3Rikge1xuICAgICAgYnl0ZUFycmF5LnB1c2goYilcbiAgICB9IGVsc2Uge1xuICAgICAgdmFyIHN0YXJ0ID0gaVxuICAgICAgaWYgKGIgPj0gMHhEODAwICYmIGIgPD0gMHhERkZGKSBpKytcbiAgICAgIHZhciBoID0gZW5jb2RlVVJJQ29tcG9uZW50KHN0ci5zbGljZShzdGFydCwgaSsxKSkuc3Vic3RyKDEpLnNwbGl0KCclJylcbiAgICAgIGZvciAodmFyIGogPSAwOyBqIDwgaC5sZW5ndGg7IGorKykge1xuICAgICAgICBieXRlQXJyYXkucHVzaChwYXJzZUludChoW2pdLCAxNikpXG4gICAgICB9XG4gICAgfVxuICB9XG4gIHJldHVybiBieXRlQXJyYXlcbn1cblxuZnVuY3Rpb24gYXNjaWlUb0J5dGVzIChzdHIpIHtcbiAgdmFyIGJ5dGVBcnJheSA9IFtdXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgc3RyLmxlbmd0aDsgaSsrKSB7XG4gICAgLy8gTm9kZSdzIGNvZGUgc2VlbXMgdG8gYmUgZG9pbmcgdGhpcyBhbmQgbm90ICYgMHg3Ri4uXG4gICAgYnl0ZUFycmF5LnB1c2goc3RyLmNoYXJDb2RlQXQoaSkgJiAweEZGKVxuICB9XG4gIHJldHVybiBieXRlQXJyYXlcbn1cblxuZnVuY3Rpb24gdXRmMTZsZVRvQnl0ZXMgKHN0cikge1xuICB2YXIgYywgaGksIGxvXG4gIHZhciBieXRlQXJyYXkgPSBbXVxuICBmb3IgKHZhciBpID0gMDsgaSA8IHN0ci5sZW5ndGg7IGkrKykge1xuICAgIGMgPSBzdHIuY2hhckNvZGVBdChpKVxuICAgIGhpID0gYyA+PiA4XG4gICAgbG8gPSBjICUgMjU2XG4gICAgYnl0ZUFycmF5LnB1c2gobG8pXG4gICAgYnl0ZUFycmF5LnB1c2goaGkpXG4gIH1cblxuICByZXR1cm4gYnl0ZUFycmF5XG59XG5cbmZ1bmN0aW9uIGJhc2U2NFRvQnl0ZXMgKHN0cikge1xuICByZXR1cm4gYmFzZTY0LnRvQnl0ZUFycmF5KHN0cilcbn1cblxuZnVuY3Rpb24gYmxpdEJ1ZmZlciAoc3JjLCBkc3QsIG9mZnNldCwgbGVuZ3RoKSB7XG4gIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICBpZiAoKGkgKyBvZmZzZXQgPj0gZHN0Lmxlbmd0aCkgfHwgKGkgPj0gc3JjLmxlbmd0aCkpXG4gICAgICBicmVha1xuICAgIGRzdFtpICsgb2Zmc2V0XSA9IHNyY1tpXVxuICB9XG4gIHJldHVybiBpXG59XG5cbmZ1bmN0aW9uIGRlY29kZVV0ZjhDaGFyIChzdHIpIHtcbiAgdHJ5IHtcbiAgICByZXR1cm4gZGVjb2RlVVJJQ29tcG9uZW50KHN0cilcbiAgfSBjYXRjaCAoZXJyKSB7XG4gICAgcmV0dXJuIFN0cmluZy5mcm9tQ2hhckNvZGUoMHhGRkZEKSAvLyBVVEYgOCBpbnZhbGlkIGNoYXJcbiAgfVxufVxuIiwidmFyIGxvb2t1cCA9ICdBQkNERUZHSElKS0xNTk9QUVJTVFVWV1hZWmFiY2RlZmdoaWprbG1ub3BxcnN0dXZ3eHl6MDEyMzQ1Njc4OSsvJztcblxuOyhmdW5jdGlvbiAoZXhwb3J0cykge1xuXHQndXNlIHN0cmljdCc7XG5cbiAgdmFyIEFyciA9ICh0eXBlb2YgVWludDhBcnJheSAhPT0gJ3VuZGVmaW5lZCcpXG4gICAgPyBVaW50OEFycmF5XG4gICAgOiBBcnJheVxuXG5cdHZhciBQTFVTICAgPSAnKycuY2hhckNvZGVBdCgwKVxuXHR2YXIgU0xBU0ggID0gJy8nLmNoYXJDb2RlQXQoMClcblx0dmFyIE5VTUJFUiA9ICcwJy5jaGFyQ29kZUF0KDApXG5cdHZhciBMT1dFUiAgPSAnYScuY2hhckNvZGVBdCgwKVxuXHR2YXIgVVBQRVIgID0gJ0EnLmNoYXJDb2RlQXQoMClcblxuXHRmdW5jdGlvbiBkZWNvZGUgKGVsdCkge1xuXHRcdHZhciBjb2RlID0gZWx0LmNoYXJDb2RlQXQoMClcblx0XHRpZiAoY29kZSA9PT0gUExVUylcblx0XHRcdHJldHVybiA2MiAvLyAnKydcblx0XHRpZiAoY29kZSA9PT0gU0xBU0gpXG5cdFx0XHRyZXR1cm4gNjMgLy8gJy8nXG5cdFx0aWYgKGNvZGUgPCBOVU1CRVIpXG5cdFx0XHRyZXR1cm4gLTEgLy9ubyBtYXRjaFxuXHRcdGlmIChjb2RlIDwgTlVNQkVSICsgMTApXG5cdFx0XHRyZXR1cm4gY29kZSAtIE5VTUJFUiArIDI2ICsgMjZcblx0XHRpZiAoY29kZSA8IFVQUEVSICsgMjYpXG5cdFx0XHRyZXR1cm4gY29kZSAtIFVQUEVSXG5cdFx0aWYgKGNvZGUgPCBMT1dFUiArIDI2KVxuXHRcdFx0cmV0dXJuIGNvZGUgLSBMT1dFUiArIDI2XG5cdH1cblxuXHRmdW5jdGlvbiBiNjRUb0J5dGVBcnJheSAoYjY0KSB7XG5cdFx0dmFyIGksIGosIGwsIHRtcCwgcGxhY2VIb2xkZXJzLCBhcnJcblxuXHRcdGlmIChiNjQubGVuZ3RoICUgNCA+IDApIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcignSW52YWxpZCBzdHJpbmcuIExlbmd0aCBtdXN0IGJlIGEgbXVsdGlwbGUgb2YgNCcpXG5cdFx0fVxuXG5cdFx0Ly8gdGhlIG51bWJlciBvZiBlcXVhbCBzaWducyAocGxhY2UgaG9sZGVycylcblx0XHQvLyBpZiB0aGVyZSBhcmUgdHdvIHBsYWNlaG9sZGVycywgdGhhbiB0aGUgdHdvIGNoYXJhY3RlcnMgYmVmb3JlIGl0XG5cdFx0Ly8gcmVwcmVzZW50IG9uZSBieXRlXG5cdFx0Ly8gaWYgdGhlcmUgaXMgb25seSBvbmUsIHRoZW4gdGhlIHRocmVlIGNoYXJhY3RlcnMgYmVmb3JlIGl0IHJlcHJlc2VudCAyIGJ5dGVzXG5cdFx0Ly8gdGhpcyBpcyBqdXN0IGEgY2hlYXAgaGFjayB0byBub3QgZG8gaW5kZXhPZiB0d2ljZVxuXHRcdHZhciBsZW4gPSBiNjQubGVuZ3RoXG5cdFx0cGxhY2VIb2xkZXJzID0gJz0nID09PSBiNjQuY2hhckF0KGxlbiAtIDIpID8gMiA6ICc9JyA9PT0gYjY0LmNoYXJBdChsZW4gLSAxKSA/IDEgOiAwXG5cblx0XHQvLyBiYXNlNjQgaXMgNC8zICsgdXAgdG8gdHdvIGNoYXJhY3RlcnMgb2YgdGhlIG9yaWdpbmFsIGRhdGFcblx0XHRhcnIgPSBuZXcgQXJyKGI2NC5sZW5ndGggKiAzIC8gNCAtIHBsYWNlSG9sZGVycylcblxuXHRcdC8vIGlmIHRoZXJlIGFyZSBwbGFjZWhvbGRlcnMsIG9ubHkgZ2V0IHVwIHRvIHRoZSBsYXN0IGNvbXBsZXRlIDQgY2hhcnNcblx0XHRsID0gcGxhY2VIb2xkZXJzID4gMCA/IGI2NC5sZW5ndGggLSA0IDogYjY0Lmxlbmd0aFxuXG5cdFx0dmFyIEwgPSAwXG5cblx0XHRmdW5jdGlvbiBwdXNoICh2KSB7XG5cdFx0XHRhcnJbTCsrXSA9IHZcblx0XHR9XG5cblx0XHRmb3IgKGkgPSAwLCBqID0gMDsgaSA8IGw7IGkgKz0gNCwgaiArPSAzKSB7XG5cdFx0XHR0bXAgPSAoZGVjb2RlKGI2NC5jaGFyQXQoaSkpIDw8IDE4KSB8IChkZWNvZGUoYjY0LmNoYXJBdChpICsgMSkpIDw8IDEyKSB8IChkZWNvZGUoYjY0LmNoYXJBdChpICsgMikpIDw8IDYpIHwgZGVjb2RlKGI2NC5jaGFyQXQoaSArIDMpKVxuXHRcdFx0cHVzaCgodG1wICYgMHhGRjAwMDApID4+IDE2KVxuXHRcdFx0cHVzaCgodG1wICYgMHhGRjAwKSA+PiA4KVxuXHRcdFx0cHVzaCh0bXAgJiAweEZGKVxuXHRcdH1cblxuXHRcdGlmIChwbGFjZUhvbGRlcnMgPT09IDIpIHtcblx0XHRcdHRtcCA9IChkZWNvZGUoYjY0LmNoYXJBdChpKSkgPDwgMikgfCAoZGVjb2RlKGI2NC5jaGFyQXQoaSArIDEpKSA+PiA0KVxuXHRcdFx0cHVzaCh0bXAgJiAweEZGKVxuXHRcdH0gZWxzZSBpZiAocGxhY2VIb2xkZXJzID09PSAxKSB7XG5cdFx0XHR0bXAgPSAoZGVjb2RlKGI2NC5jaGFyQXQoaSkpIDw8IDEwKSB8IChkZWNvZGUoYjY0LmNoYXJBdChpICsgMSkpIDw8IDQpIHwgKGRlY29kZShiNjQuY2hhckF0KGkgKyAyKSkgPj4gMilcblx0XHRcdHB1c2goKHRtcCA+PiA4KSAmIDB4RkYpXG5cdFx0XHRwdXNoKHRtcCAmIDB4RkYpXG5cdFx0fVxuXG5cdFx0cmV0dXJuIGFyclxuXHR9XG5cblx0ZnVuY3Rpb24gdWludDhUb0Jhc2U2NCAodWludDgpIHtcblx0XHR2YXIgaSxcblx0XHRcdGV4dHJhQnl0ZXMgPSB1aW50OC5sZW5ndGggJSAzLCAvLyBpZiB3ZSBoYXZlIDEgYnl0ZSBsZWZ0LCBwYWQgMiBieXRlc1xuXHRcdFx0b3V0cHV0ID0gXCJcIixcblx0XHRcdHRlbXAsIGxlbmd0aFxuXG5cdFx0ZnVuY3Rpb24gZW5jb2RlIChudW0pIHtcblx0XHRcdHJldHVybiBsb29rdXAuY2hhckF0KG51bSlcblx0XHR9XG5cblx0XHRmdW5jdGlvbiB0cmlwbGV0VG9CYXNlNjQgKG51bSkge1xuXHRcdFx0cmV0dXJuIGVuY29kZShudW0gPj4gMTggJiAweDNGKSArIGVuY29kZShudW0gPj4gMTIgJiAweDNGKSArIGVuY29kZShudW0gPj4gNiAmIDB4M0YpICsgZW5jb2RlKG51bSAmIDB4M0YpXG5cdFx0fVxuXG5cdFx0Ly8gZ28gdGhyb3VnaCB0aGUgYXJyYXkgZXZlcnkgdGhyZWUgYnl0ZXMsIHdlJ2xsIGRlYWwgd2l0aCB0cmFpbGluZyBzdHVmZiBsYXRlclxuXHRcdGZvciAoaSA9IDAsIGxlbmd0aCA9IHVpbnQ4Lmxlbmd0aCAtIGV4dHJhQnl0ZXM7IGkgPCBsZW5ndGg7IGkgKz0gMykge1xuXHRcdFx0dGVtcCA9ICh1aW50OFtpXSA8PCAxNikgKyAodWludDhbaSArIDFdIDw8IDgpICsgKHVpbnQ4W2kgKyAyXSlcblx0XHRcdG91dHB1dCArPSB0cmlwbGV0VG9CYXNlNjQodGVtcClcblx0XHR9XG5cblx0XHQvLyBwYWQgdGhlIGVuZCB3aXRoIHplcm9zLCBidXQgbWFrZSBzdXJlIHRvIG5vdCBmb3JnZXQgdGhlIGV4dHJhIGJ5dGVzXG5cdFx0c3dpdGNoIChleHRyYUJ5dGVzKSB7XG5cdFx0XHRjYXNlIDE6XG5cdFx0XHRcdHRlbXAgPSB1aW50OFt1aW50OC5sZW5ndGggLSAxXVxuXHRcdFx0XHRvdXRwdXQgKz0gZW5jb2RlKHRlbXAgPj4gMilcblx0XHRcdFx0b3V0cHV0ICs9IGVuY29kZSgodGVtcCA8PCA0KSAmIDB4M0YpXG5cdFx0XHRcdG91dHB1dCArPSAnPT0nXG5cdFx0XHRcdGJyZWFrXG5cdFx0XHRjYXNlIDI6XG5cdFx0XHRcdHRlbXAgPSAodWludDhbdWludDgubGVuZ3RoIC0gMl0gPDwgOCkgKyAodWludDhbdWludDgubGVuZ3RoIC0gMV0pXG5cdFx0XHRcdG91dHB1dCArPSBlbmNvZGUodGVtcCA+PiAxMClcblx0XHRcdFx0b3V0cHV0ICs9IGVuY29kZSgodGVtcCA+PiA0KSAmIDB4M0YpXG5cdFx0XHRcdG91dHB1dCArPSBlbmNvZGUoKHRlbXAgPDwgMikgJiAweDNGKVxuXHRcdFx0XHRvdXRwdXQgKz0gJz0nXG5cdFx0XHRcdGJyZWFrXG5cdFx0fVxuXG5cdFx0cmV0dXJuIG91dHB1dFxuXHR9XG5cblx0ZXhwb3J0cy50b0J5dGVBcnJheSA9IGI2NFRvQnl0ZUFycmF5XG5cdGV4cG9ydHMuZnJvbUJ5dGVBcnJheSA9IHVpbnQ4VG9CYXNlNjRcbn0odHlwZW9mIGV4cG9ydHMgPT09ICd1bmRlZmluZWQnID8gKHRoaXMuYmFzZTY0anMgPSB7fSkgOiBleHBvcnRzKSlcbiIsImV4cG9ydHMucmVhZCA9IGZ1bmN0aW9uKGJ1ZmZlciwgb2Zmc2V0LCBpc0xFLCBtTGVuLCBuQnl0ZXMpIHtcbiAgdmFyIGUsIG0sXG4gICAgICBlTGVuID0gbkJ5dGVzICogOCAtIG1MZW4gLSAxLFxuICAgICAgZU1heCA9ICgxIDw8IGVMZW4pIC0gMSxcbiAgICAgIGVCaWFzID0gZU1heCA+PiAxLFxuICAgICAgbkJpdHMgPSAtNyxcbiAgICAgIGkgPSBpc0xFID8gKG5CeXRlcyAtIDEpIDogMCxcbiAgICAgIGQgPSBpc0xFID8gLTEgOiAxLFxuICAgICAgcyA9IGJ1ZmZlcltvZmZzZXQgKyBpXTtcblxuICBpICs9IGQ7XG5cbiAgZSA9IHMgJiAoKDEgPDwgKC1uQml0cykpIC0gMSk7XG4gIHMgPj49ICgtbkJpdHMpO1xuICBuQml0cyArPSBlTGVuO1xuICBmb3IgKDsgbkJpdHMgPiAwOyBlID0gZSAqIDI1NiArIGJ1ZmZlcltvZmZzZXQgKyBpXSwgaSArPSBkLCBuQml0cyAtPSA4KTtcblxuICBtID0gZSAmICgoMSA8PCAoLW5CaXRzKSkgLSAxKTtcbiAgZSA+Pj0gKC1uQml0cyk7XG4gIG5CaXRzICs9IG1MZW47XG4gIGZvciAoOyBuQml0cyA+IDA7IG0gPSBtICogMjU2ICsgYnVmZmVyW29mZnNldCArIGldLCBpICs9IGQsIG5CaXRzIC09IDgpO1xuXG4gIGlmIChlID09PSAwKSB7XG4gICAgZSA9IDEgLSBlQmlhcztcbiAgfSBlbHNlIGlmIChlID09PSBlTWF4KSB7XG4gICAgcmV0dXJuIG0gPyBOYU4gOiAoKHMgPyAtMSA6IDEpICogSW5maW5pdHkpO1xuICB9IGVsc2Uge1xuICAgIG0gPSBtICsgTWF0aC5wb3coMiwgbUxlbik7XG4gICAgZSA9IGUgLSBlQmlhcztcbiAgfVxuICByZXR1cm4gKHMgPyAtMSA6IDEpICogbSAqIE1hdGgucG93KDIsIGUgLSBtTGVuKTtcbn07XG5cbmV4cG9ydHMud3JpdGUgPSBmdW5jdGlvbihidWZmZXIsIHZhbHVlLCBvZmZzZXQsIGlzTEUsIG1MZW4sIG5CeXRlcykge1xuICB2YXIgZSwgbSwgYyxcbiAgICAgIGVMZW4gPSBuQnl0ZXMgKiA4IC0gbUxlbiAtIDEsXG4gICAgICBlTWF4ID0gKDEgPDwgZUxlbikgLSAxLFxuICAgICAgZUJpYXMgPSBlTWF4ID4+IDEsXG4gICAgICBydCA9IChtTGVuID09PSAyMyA/IE1hdGgucG93KDIsIC0yNCkgLSBNYXRoLnBvdygyLCAtNzcpIDogMCksXG4gICAgICBpID0gaXNMRSA/IDAgOiAobkJ5dGVzIC0gMSksXG4gICAgICBkID0gaXNMRSA/IDEgOiAtMSxcbiAgICAgIHMgPSB2YWx1ZSA8IDAgfHwgKHZhbHVlID09PSAwICYmIDEgLyB2YWx1ZSA8IDApID8gMSA6IDA7XG5cbiAgdmFsdWUgPSBNYXRoLmFicyh2YWx1ZSk7XG5cbiAgaWYgKGlzTmFOKHZhbHVlKSB8fCB2YWx1ZSA9PT0gSW5maW5pdHkpIHtcbiAgICBtID0gaXNOYU4odmFsdWUpID8gMSA6IDA7XG4gICAgZSA9IGVNYXg7XG4gIH0gZWxzZSB7XG4gICAgZSA9IE1hdGguZmxvb3IoTWF0aC5sb2codmFsdWUpIC8gTWF0aC5MTjIpO1xuICAgIGlmICh2YWx1ZSAqIChjID0gTWF0aC5wb3coMiwgLWUpKSA8IDEpIHtcbiAgICAgIGUtLTtcbiAgICAgIGMgKj0gMjtcbiAgICB9XG4gICAgaWYgKGUgKyBlQmlhcyA+PSAxKSB7XG4gICAgICB2YWx1ZSArPSBydCAvIGM7XG4gICAgfSBlbHNlIHtcbiAgICAgIHZhbHVlICs9IHJ0ICogTWF0aC5wb3coMiwgMSAtIGVCaWFzKTtcbiAgICB9XG4gICAgaWYgKHZhbHVlICogYyA+PSAyKSB7XG4gICAgICBlKys7XG4gICAgICBjIC89IDI7XG4gICAgfVxuXG4gICAgaWYgKGUgKyBlQmlhcyA+PSBlTWF4KSB7XG4gICAgICBtID0gMDtcbiAgICAgIGUgPSBlTWF4O1xuICAgIH0gZWxzZSBpZiAoZSArIGVCaWFzID49IDEpIHtcbiAgICAgIG0gPSAodmFsdWUgKiBjIC0gMSkgKiBNYXRoLnBvdygyLCBtTGVuKTtcbiAgICAgIGUgPSBlICsgZUJpYXM7XG4gICAgfSBlbHNlIHtcbiAgICAgIG0gPSB2YWx1ZSAqIE1hdGgucG93KDIsIGVCaWFzIC0gMSkgKiBNYXRoLnBvdygyLCBtTGVuKTtcbiAgICAgIGUgPSAwO1xuICAgIH1cbiAgfVxuXG4gIGZvciAoOyBtTGVuID49IDg7IGJ1ZmZlcltvZmZzZXQgKyBpXSA9IG0gJiAweGZmLCBpICs9IGQsIG0gLz0gMjU2LCBtTGVuIC09IDgpO1xuXG4gIGUgPSAoZSA8PCBtTGVuKSB8IG07XG4gIGVMZW4gKz0gbUxlbjtcbiAgZm9yICg7IGVMZW4gPiAwOyBidWZmZXJbb2Zmc2V0ICsgaV0gPSBlICYgMHhmZiwgaSArPSBkLCBlIC89IDI1NiwgZUxlbiAtPSA4KTtcblxuICBidWZmZXJbb2Zmc2V0ICsgaSAtIGRdIHw9IHMgKiAxMjg7XG59O1xuIiwiXG4vKipcbiAqIGlzQXJyYXlcbiAqL1xuXG52YXIgaXNBcnJheSA9IEFycmF5LmlzQXJyYXk7XG5cbi8qKlxuICogdG9TdHJpbmdcbiAqL1xuXG52YXIgc3RyID0gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZztcblxuLyoqXG4gKiBXaGV0aGVyIG9yIG5vdCB0aGUgZ2l2ZW4gYHZhbGBcbiAqIGlzIGFuIGFycmF5LlxuICpcbiAqIGV4YW1wbGU6XG4gKlxuICogICAgICAgIGlzQXJyYXkoW10pO1xuICogICAgICAgIC8vID4gdHJ1ZVxuICogICAgICAgIGlzQXJyYXkoYXJndW1lbnRzKTtcbiAqICAgICAgICAvLyA+IGZhbHNlXG4gKiAgICAgICAgaXNBcnJheSgnJyk7XG4gKiAgICAgICAgLy8gPiBmYWxzZVxuICpcbiAqIEBwYXJhbSB7bWl4ZWR9IHZhbFxuICogQHJldHVybiB7Ym9vbH1cbiAqL1xuXG5tb2R1bGUuZXhwb3J0cyA9IGlzQXJyYXkgfHwgZnVuY3Rpb24gKHZhbCkge1xuICByZXR1cm4gISEgdmFsICYmICdbb2JqZWN0IEFycmF5XScgPT0gc3RyLmNhbGwodmFsKTtcbn07XG4iLCIvLyBzaGltIGZvciB1c2luZyBwcm9jZXNzIGluIGJyb3dzZXJcblxudmFyIHByb2Nlc3MgPSBtb2R1bGUuZXhwb3J0cyA9IHt9O1xuXG5wcm9jZXNzLm5leHRUaWNrID0gKGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgY2FuU2V0SW1tZWRpYXRlID0gdHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCdcbiAgICAmJiB3aW5kb3cuc2V0SW1tZWRpYXRlO1xuICAgIHZhciBjYW5NdXRhdGlvbk9ic2VydmVyID0gdHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCdcbiAgICAmJiB3aW5kb3cuTXV0YXRpb25PYnNlcnZlcjtcbiAgICB2YXIgY2FuUG9zdCA9IHR5cGVvZiB3aW5kb3cgIT09ICd1bmRlZmluZWQnXG4gICAgJiYgd2luZG93LnBvc3RNZXNzYWdlICYmIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyXG4gICAgO1xuXG4gICAgaWYgKGNhblNldEltbWVkaWF0ZSkge1xuICAgICAgICByZXR1cm4gZnVuY3Rpb24gKGYpIHsgcmV0dXJuIHdpbmRvdy5zZXRJbW1lZGlhdGUoZikgfTtcbiAgICB9XG5cbiAgICB2YXIgcXVldWUgPSBbXTtcblxuICAgIGlmIChjYW5NdXRhdGlvbk9ic2VydmVyKSB7XG4gICAgICAgIHZhciBoaWRkZW5EaXYgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xuICAgICAgICB2YXIgb2JzZXJ2ZXIgPSBuZXcgTXV0YXRpb25PYnNlcnZlcihmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICB2YXIgcXVldWVMaXN0ID0gcXVldWUuc2xpY2UoKTtcbiAgICAgICAgICAgIHF1ZXVlLmxlbmd0aCA9IDA7XG4gICAgICAgICAgICBxdWV1ZUxpc3QuZm9yRWFjaChmdW5jdGlvbiAoZm4pIHtcbiAgICAgICAgICAgICAgICBmbigpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIG9ic2VydmVyLm9ic2VydmUoaGlkZGVuRGl2LCB7IGF0dHJpYnV0ZXM6IHRydWUgfSk7XG5cbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uIG5leHRUaWNrKGZuKSB7XG4gICAgICAgICAgICBpZiAoIXF1ZXVlLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgIGhpZGRlbkRpdi5zZXRBdHRyaWJ1dGUoJ3llcycsICdubycpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcXVldWUucHVzaChmbik7XG4gICAgICAgIH07XG4gICAgfVxuXG4gICAgaWYgKGNhblBvc3QpIHtcbiAgICAgICAgd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoJ21lc3NhZ2UnLCBmdW5jdGlvbiAoZXYpIHtcbiAgICAgICAgICAgIHZhciBzb3VyY2UgPSBldi5zb3VyY2U7XG4gICAgICAgICAgICBpZiAoKHNvdXJjZSA9PT0gd2luZG93IHx8IHNvdXJjZSA9PT0gbnVsbCkgJiYgZXYuZGF0YSA9PT0gJ3Byb2Nlc3MtdGljaycpIHtcbiAgICAgICAgICAgICAgICBldi5zdG9wUHJvcGFnYXRpb24oKTtcbiAgICAgICAgICAgICAgICBpZiAocXVldWUubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgICAgICAgICB2YXIgZm4gPSBxdWV1ZS5zaGlmdCgpO1xuICAgICAgICAgICAgICAgICAgICBmbigpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSwgdHJ1ZSk7XG5cbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uIG5leHRUaWNrKGZuKSB7XG4gICAgICAgICAgICBxdWV1ZS5wdXNoKGZuKTtcbiAgICAgICAgICAgIHdpbmRvdy5wb3N0TWVzc2FnZSgncHJvY2Vzcy10aWNrJywgJyonKTtcbiAgICAgICAgfTtcbiAgICB9XG5cbiAgICByZXR1cm4gZnVuY3Rpb24gbmV4dFRpY2soZm4pIHtcbiAgICAgICAgc2V0VGltZW91dChmbiwgMCk7XG4gICAgfTtcbn0pKCk7XG5cbnByb2Nlc3MudGl0bGUgPSAnYnJvd3Nlcic7XG5wcm9jZXNzLmJyb3dzZXIgPSB0cnVlO1xucHJvY2Vzcy5lbnYgPSB7fTtcbnByb2Nlc3MuYXJndiA9IFtdO1xuXG5mdW5jdGlvbiBub29wKCkge31cblxucHJvY2Vzcy5vbiA9IG5vb3A7XG5wcm9jZXNzLmFkZExpc3RlbmVyID0gbm9vcDtcbnByb2Nlc3Mub25jZSA9IG5vb3A7XG5wcm9jZXNzLm9mZiA9IG5vb3A7XG5wcm9jZXNzLnJlbW92ZUxpc3RlbmVyID0gbm9vcDtcbnByb2Nlc3MucmVtb3ZlQWxsTGlzdGVuZXJzID0gbm9vcDtcbnByb2Nlc3MuZW1pdCA9IG5vb3A7XG5cbnByb2Nlc3MuYmluZGluZyA9IGZ1bmN0aW9uIChuYW1lKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdwcm9jZXNzLmJpbmRpbmcgaXMgbm90IHN1cHBvcnRlZCcpO1xufTtcblxuLy8gVE9ETyhzaHR5bG1hbilcbnByb2Nlc3MuY3dkID0gZnVuY3Rpb24gKCkgeyByZXR1cm4gJy8nIH07XG5wcm9jZXNzLmNoZGlyID0gZnVuY3Rpb24gKGRpcikge1xuICAgIHRocm93IG5ldyBFcnJvcigncHJvY2Vzcy5jaGRpciBpcyBub3Qgc3VwcG9ydGVkJyk7XG59O1xuIl19
