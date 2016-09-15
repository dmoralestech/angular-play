// Scope
function Scope() {

    // Watch
    this.$$watchers = [];

    this.$watch = function(watcherFn, listenerFn) {
        this.$$watchers.push({
            watcherFn: watcherFn,
            listenerFn: listenerFn
        });
    };

    // Digest
    this.$digest = function() {
        this.$$watchers.forEach(function(watcher) {
            var newValue = watcher.watcherFn();
            var oldValue = watcher.last;
            if (newValue !== oldValue) {
                watcher.listenerFn(newValue, oldValue);
                watcher.last = newValue;
            }
        });
    };

    // Apply
    this.$apply = function(exprFn) {
        try {
            if (exprFn) {
                exprFn();
            }
        } finally {
            this.$digest();
        }
    };

    this.$$directives = {
        'ng-bind': function($scope, element, attrs) {
            var prop = element.attributes['ng-bind'].value;
            $scope.$watch(function() {
                return $scope[prop];
            }, function(newValue, oldValue) {
                element.innerHTML = $scope[prop];
            });
        },
        'ng-model': function($scope, element, attrs) {
            var prop = element.attributes['ng-model'].value;
            $scope.$watch(function() {
                return $scope[prop];
            }, function(newValue, oldValue) {
                element.addEventListener("keyup", function(){
                    $scope[prop] = element.value;
                    $scope.$apply();
                });
            });
        }
    };

    // Compile
    this.$compile = function(element, $scope) {
        Array.prototype.forEach.call(
            element.children,
            function(child) {
                $scope.$compile(child, $scope);
            });
        Array.prototype.forEach.call(
            element.attributes,
            function(attribute) {
                var directive = $scope.$$directives[attribute.name];
                if (directive) {
                    directive($scope, element, element.attributes);
                }
            });
    };

    this.$compile(document.body, this);

    this.$apply();
}

function Controller (){
    this.scope = new Scope();
}

function Angular(){
    this.module = function(name, requires){
        return this;
    };

    this.controllers = [];

    this.controller = function(name, ctrlFn){
        var ctrl = new Controller();
        ctrlFn(ctrl.scope);
        ctrl.scope.$apply();
        this.controllers.push(ctrl);
    };
}

window.angular = new Angular();