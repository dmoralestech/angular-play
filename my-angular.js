// Scope
function Scope() {

    console.log('inside Scope..');

    // Watch
    this.$$watchers = [];

    this.$watch = function (watcherFn, listenerFn) {
        this.$$watchers.push({
            watcherFn: watcherFn,
            listenerFn: listenerFn
        });
        console.log('this.$watch', this.$$watchers);
    };

    // Digest
    this.$digest = function () {
        console.log('calling this.$digest...');
        this.$$watchers.forEach(function (watcher) {
            var newValue = watcher.watcherFn();
            var oldValue = watcher.last;
            if (newValue !== oldValue) {
                watcher.listenerFn(newValue, oldValue);
                watcher.last = newValue;
            }
        });
    };

    // Apply
    this.$apply = function (exprFn) {
        try {
            if (exprFn) {
                console.log('exprFn', exprFn);
                exprFn();
            }
        } finally {
            this.$digest();
        }
    };

    this.$$directives = {
        'ng-bind': function ($scope, element, attrs) {
            console.log('ng-bind');
            var prop = element.attributes['ng-bind'].value;
            $scope.$watch(function () {
                return $scope[prop];
            }, function (newValue, oldValue) {
                element.innerHTML = $scope[prop];
            });
        },
        'ng-model': function ($scope, element, attrs) {
            console.log('ng-model');
            var prop = element.attributes['ng-model'].value;
            $scope.$watch(function () {
                return $scope[prop];
            }, function (newValue, oldValue) {
                element.addEventListener("keyup", function () {
                    $scope[prop] = element.value;
                    $scope.$apply();
                });
            });
        }
    };

    // Compile
    this.$compile = function (element, $scope) {
        console.log('this.$compile...', element, $scope);
        Array.prototype.forEach.call(
            element.children,
            function (child) {
                $scope.$compile(child, $scope);
            });
        Array.prototype.forEach.call(
            element.attributes,
            function (attribute) {
                var directive = $scope.$$directives[attribute.name];
                if (directive) {
                    directive($scope, element, element.attributes);
                }
            });
    };

    this.$compile(document.body, this);

    this.$apply();
}

function Controller() {
    console.log('calling Controller and creating new scope..')
    this.scope = new Scope();
    console.log('scope created', this.scope);
}

function Angular() {
    this.module = function (name, requires) {
        console.log('calling module....', name, requires);
        return this;
    };

    this.controllers = [];

    this.controller = function (name, ctrlFn) {
        console.log('calling controller...', name, ctrlFn);
        var ctrl = new Controller();
        console.log('calling ', ctrlFn, 'with', ctrl.scope);
        ctrlFn(ctrl.scope);
        console.log('callng ctrl.scope.$apply()');
        ctrl.scope.$apply();
        console.log('calling this.controllers.push', ctrl);
        this.controllers.push(ctrl);
    };
}

window.angular = new Angular();