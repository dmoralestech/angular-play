/* global Scope */

var Provider = Provider || (function () {
        'use strict';

        return {
            get: function (name, locals) {
                if (this._cache[name]) {
                    return this._cache[name];
                }
                var provider = this._providers[name];
                if (!provider || typeof provider !== 'function') {
                    return null;
                }
                return (this._cache[name] = this.invoke(provider, locals));
            },

            directive: function (name, fn) {
                this._register(name + Provider.DIRECTIVES_SUFFIX, fn);
            },

            controller: function (name, fn) {
                this._register(name + Provider.CONTROLLERS_SUFFIX, function () {
                    return fn;
                });
            },

            service: function (name, fn) {
                this._register(name, fn);
            },

            annotate: function (fn) {
                var res = fn.toString()
                    .replace(/((\/\/.*$)|(\/\*[\s\S]*?\*\/))/mg, '')
                    .match(/\((.*?)\)/);
                if (res && res[1]) {
                    return res[1].split(',').map(function (d) {
                        return d.trim();
                    });
                }
                return [];
            },

            invoke: function (fn, locals) {
                locals = locals || {};
                var deps = this.annotate(fn).map(function (s) {
                    return locals[s] || this.get(s, locals);
                }, this);
                return fn.apply(null, deps);
            },

            _cache: {$rootScope: new Scope()},

            _providers: {},

            _register: function (name, service) {
                this._providers[name] = service;
            }
        };
    }());

Provider.DIRECTIVES_SUFFIX = 'Directive';
Provider.CONTROLLERS_SUFFIX = 'Controller';

/* global Utils */

function Scope(parent, id) {
    'use strict';
    this.$$watchers = [];
    this.$$children = [];
    this.$parent = parent;
    this.$id = id || 0;
}

Scope.counter = 0;

Scope.prototype.$watch = function (exp, fn) {
    'use strict';
    this.$$watchers.push({
        exp: exp,
        fn: fn,
        last: Utils.clone(this.$eval(exp))
    });
};

// In the complete implementation there're
// lexer, parser and interpreter.
// Note that this implementation is pretty evil!
// It uses two dangerouse features:
// - eval
// - with
// The reason the 'use strict' statement is
// omitted is because of `with`
Scope.prototype.$eval = function (exp) {
    var val;
    if (typeof exp === 'function') {
        val = exp.call(this);
    } else {
        try {
            with (this) {
                val = eval(exp);
            }
        } catch (e) {
            val = undefined;
        }
    }
    return val;
};

Scope.prototype.$new = function () {
    'use strict';
    Scope.counter += 1;
    var obj = new Scope(this, Scope.counter);
    Object.setPrototypeOf(obj, this);
    this.$$children.push(obj);
    return obj;
};

Scope.prototype.$destroy = function () {
    'use strict';
    var pc = this.$parent.$$children;
    pc.splice(pc.indexOf(this), 1);
};

Scope.prototype.$digest = function () {
    'use strict';
    var dirty, watcher, current, i;
    do {
        dirty = false;
        for (i = 0; i < this.$$watchers.length; i += 1) {
            watcher = this.$$watchers[i];
            current = this.$eval(watcher.exp);
            if (!Utils.equals(watcher.last, current)) {
                watcher.last = Utils.clone(current);
                dirty = true;
                watcher.fn(current);
            }
        }
    } while (dirty);
    for (i = 0; i < this.$$children.length; i += 1) {
        this.$$children[i].$digest();
    }
};

/**
 * Equals and clone are not reliable when
 * there're properties in the prototype.
 *
 * DO NOT USE IN PRODUCTION!
 */
var Utils = {
    equals: function (a, b) {
        'use strict';
        return JSON.stringify(a) === JSON.stringify(b);
    },
    clone: function (a) {
        'use strict';
        try {
            return JSON.parse(JSON.stringify(a));
        } catch (e) {
            return undefined;
        }
    }
};


/* Alternative implementation of the DOMCompiler by @nshahpazov */
/* global Provider */
var DOMCompiler = DOMCompiler || (function () {
        'use strict';
        return {
            bootstrap: function () {
                this.compile(document.children[0], Provider.get('$rootScope'));
            },
            callDirectives: function (dom, $scope) {
                var isCreated = false;
                [].map.call(dom.attributes || [], function (attr) {
                    var directive = Provider.get(attr.name + Provider.DIRECTIVES_SUFFIX);
                    return directive && {
                            expr: attr.value,
                            provision: directive
                        };
                })
                    .filter(Boolean)
                    .forEach(function (d) {
                        if (d.provision.scope && !isCreated) {
                            isCreated = true;
                            $scope = $scope.$new();
                        }
                        d.provision.link(dom, $scope, d.expr);
                    });
                return $scope;
            },
            compile: function (dom, scope) {
                scope = this.callDirectives(dom, scope);
                [].forEach.call(dom.children || [], function (d) {
                    this.compile(d, scope);
                }.bind(this));
            }
        };
    }());

/* global Provider */
Provider.directive('ngl-bind', function () {
    'use strict';
    return {
        scope: false,
        link: function (el, scope, exp) {
            el.innerHTML = scope.$eval(exp);
            scope.$watch(exp, function (val) {
                el.innerHTML = val;
            });
        }
    };
});

/* global Provider */
Provider.directive('ngl-click', function () {
    'use strict';
    return {
        scope: false,
        link: function (el, scope, exp) {
            el.onclick = function () {
                scope.$eval(exp);
                scope.$digest();
            };
        }
    };
});

/* global Provider */
Provider.directive('ngl-controller', function () {
    'use strict';
    return {
        scope: true,
        link: function (el, scope, exp) {
            var ctrl = Provider.get(exp + Provider.CONTROLLERS_SUFFIX);
            Provider.invoke(ctrl, { $scope: scope });
        }
    };
});

/* global Provider */
Provider.directive('ngl-model', function () {
    'use strict';
    return {
        link:  function (el, scope, exp) {
            el.onkeyup = function () {
                scope[exp] = el.value;
                scope.$digest();
            };
            scope.$watch(exp, function (val) {
                el.value = val;
            });
        }
    };
});

/* global Provider, DOMCompiler */

Provider.directive('ngl-repeat', function () {
    'use strict';
    return {
        scope: false,
        link: function (el, scope, exp) {
            var scopes = [];
            var parts = exp.split('in');
            var collectionName = parts[1].trim();
            var itemName = parts[0].trim();
            var parentNode = el.parentNode;

            function render(val) {
                var els = val;
                var currentNode;
                var s;
                while (parentNode.firstChild) {
                    parentNode.removeChild(parentNode.firstChild);
                }
                scopes.forEach(function (s) {
                    s.$destroy();
                });
                scopes = [];
                els.forEach(function (val) {
                    currentNode = el.cloneNode();
                    currentNode.removeAttribute('ngl-repeat');
                    currentNode.removeAttribute('ngl-scope');
                    s = scope.$new();
                    scopes.push(s);
                    s[itemName] = val;
                    DOMCompiler.compile(currentNode, s);
                    parentNode.appendChild(currentNode);
                });
            }
            scope.$watch(collectionName, render);
            render(scope.$eval(collectionName));
        }
    };
});

/* global Provider */
Provider.service('interval', function ($rootScope) {
    'use strict';
    return function (fn, timeout) {
        setInterval(function () {
            fn();
            $rootScope.$digest();
        }, timeout);
    };
});

/* global Provider */
Provider.service('timeout', function ($rootScope) {
    'use strict';
    return function (fn, timeout) {
        setTimeout(function () {
            fn();
            $rootScope.$digest();
        }, timeout);
    };
});

Provider.service('RESTfulService', function () {
    return function (url) {
        // make restful call & return promise
    };
});

Provider.controller('MainCtrl', function (RESTfulService) {
    RESTfulService(url)
        .then(function (data) {
            alert(data);
        });
});

Provider.controller('MainCtrl', function ($scope) {
    $scope.bar = 0;
    $scope.foo = function () {
        $scope.bar += 1;
    };
});
