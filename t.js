/* Copyright (C) Moving Village Limited - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Proprietary and confidential
 * Written by Francis Chanyau <franky@movingvillage.com>, July 2015
 */
var defaultViewDir = "/app/views/";

$.fn.exists = function() {
    return this.length > 0;
}

$.fn.hasAttr = function(name) {
   var attr = this.attr(name);
   return typeof attr !== 'undefined' && attr !== false;
};

$.fn.tr = function(a,b,c) {
    c = typeof c !== 'undefined' ? c : function(){};
    this.velocity("transition."+a, { duration:a, complete:c });
};

window.t = typeof window.t !== "undefined" ? window.t : {
    models: {},
    collections: {},
    components: {},
    controllers: {},
    libraries: {
        Adapters: {}
    },
    app: {}
};
var t = typeof t !== "undefined" ? t : window.t;

t.libraries.App = Stapes.subclass({
    Views: {},
    controller: false,
    isCordova: false,
    appController: {},
    history: [],
    constructor: function(appController){
        var self = this;
        this.appController = t.libraries.Controller.subclass(appController);
        this.isCordova = !!window.cordova;
        if(this.isCordova){
            this.cordovaExclude();
            $(document).on("deviceready", function(){
                self.init();
            })
        }else{
            $(document).on("ready", function(){
                self.init();
            })
        }

        _.mixin({
            'whereIn': function(collection, prop, values) {
              return _.filter(collection, function(item) {
                return _.contains(values, item[prop]);
              });
            }
        });
    },
    showLoading: function(){
        $("t-loading").show().velocity({ opacity: 1 }, { duration: 300 });
    },
    hideLoading: function(){
        $("t-loading").velocity({ opacity: 0 }, { duration: 300, display: "none" });
    },
    init: function(){
        var self = this;
        this.loadViews();
        this.bodyFix();
        this.appController = new this.appController(self);
        this.bindControllerToPage(this.appController);
        this.initCollections();

        rivets.formatters.increment = function(a,b){
            return parseInt(a) + parseInt(b);
        };

        this.Views.on("ready", function(){
            self.Views.registerAllComponents();
            self.bindControllerToPage(self.appController);
            self.appController.ready(self, function(cont){
                self.initRouter();
            });
        })
    },
    _construct: function(controller, args){
        function Controller() {
            return controller.apply(this, args);
        }
        Controller.prototype = controller.prototype;
        return new Controller();
    },
    goTo: function(controller, method, args){
        t.controllers[controller].proto({
            __name: controller
        });
        var construct = true;
        if(this.controller){
            if(this.controller.__name === controller){
                construct = false;
            }
        }
        if(construct){
            this.controller = this._construct(t.controllers[controller], []);
        }
        this.controller.off("loaded");
        this.controller.off("update");
        this.controller[method].apply( t.app.controller ? t.app.controller : this.controller, args);
        this.logHistory();
    },
    logHistory: function(){
        var lastPage = this.history.slice(-1).pop();
        var thisPage = window.location.pathname;
        if(thisPage !== lastPage){
            this.history.push(window.location.pathname);
        }
    },
    initRouter: function(){
        var self = this;
        this.router = new Grapnel({ pushState: true });
        if(typeof this.appController.routes !== "undefined"){
            _.each(this.appController.routes, function(action, route){
                if(typeof action !== "function"){
                    var parts = action.split(".");
                    var controller = parts[0];
                    var method = typeof parts[1] !== "undefined" ? parts[1] : "index";
                    self.router.get(route, function(request){
                        self.goTo(controller, method, [request]);
                    });
                }else{
                    self.router.get(route, function(request){
                        action.apply(self.appController, [request]);
                    });
                }
            })
        }
    },
    navigate: function(route, showLoading){
        var self = this;
        showLoading = typeof showLoading !== "undefined" ? showLoading : true;
        if(showLoading){
            this.showLoading();
        }
        setTimeout(function(){
            self.router.navigate(route);
        }, 20);
    },
    bindControllerToPage: function(controller){
        rivets.bind($("html"), controller);
    },
    cordovaExclude: function(){
        $("*[t-cordova-exclude]").each(function(){
            $(this).remove();
        });
    },
    initCollections: function(){
        _.each(t.models, function(model, name){
            // TODO: Check if collection is already initialised before attempting to create a new instance
            t.collections[name] = typeof t.collections[name] === "undefined" ? new t.libraries.Collection(model) : new t.collections[name](model);
            model.proto({
                collection: t.collections[name]
            });
        });
    },
    loadViews: function(){
        this.Views = new t.libraries.Views();
    },
    bodyFix: function(){
        $("body").width($(window).width());
        $("body").height($(window).height());
    },
    titleBuffer: function(){
        $('title').html( $('titlebuffer').html() );
        $('titlebuffer').remove();
    },
    setTitles: function (title, subtitle) {
        $('title').html(title + " | " + subtitle);
        $('meta[name="og:title"]').attr("content", title + " | " + subtitle);
        $('meta[name="twitter:title"]').attr("content", title + " | " + subtitle);
    },
    setMetaDesc: function (metaDesc) {
        $('meta[name="description"]').attr("content", metaDesc);
        $('meta[name="og:description"]').attr("content", metaDesc);
        $('meta[name="twitter:description"]').attr("content", metaDesc);
    },
    back: function(){
        if(this.history.length > 1){
            this.history.pop();
            var lastPage = this.history.slice(-1).pop();
            this.history.pop();
            this.navigate(lastPage);
        }
    }
});

t.libraries.Component = Stapes.subclass({
    attr: {},
    value: "",
    options: [],
    preventChangeEvent: false,
    constructor: function($el, attrs){
        this.attr = attrs;
    },
    navigateTo: function(e, self){
        var href = $(this).attr("href");
        t.app.navigate(href);
        return false;
    },
    it_array: [],
    iterateable: function($el, events){
        var self = this;
        $el.data("app-events", events);
        t.app.controller.on({
            "update": function () {
                self.iterate($el);
            },
            "update-iteratable": function () {
                self.iterate($el);
            },
        });
        return self.iterate($el);
    },
    iterate: function($el){
        var self = this;
        if($el.hasAttr('app-each')){
            var keyString = $.trim($el.attr('app-each'))
            var keys = keyString.split(".");
            var array = t.app.controller.readProp(keys);
            if(typeof array === "object"){
                if(!self.compareObj(array, self.it_array)){
                    var uid = _.uniqueId("app_each_");
                    $el.attr("app-each-uid", uid);
                    self.it_array = self.cloneObj(array);
                    $("." + uid).remove();
                    var clones = [];
                    _.each(array, function(val, key){
                        if(val){
                            var attrs = t.app.Views.getAttributes($el);
                            delete attrs['app-each'];
                            delete attrs['style'];
                            attrs['app-index'] = key;
                            attrs['app-value'] = keyString + "." + key;
                            var $clone = $('<' + self.__name + '/>').attr(attrs).addClass(uid);

                            var events = $el.data("app-events");
                            if(events){
                                _.each(events, function(callback, name){
                                    $clone.on(name, callback);
                                })
                            }
                            clones.push($clone);
                        }
                    });
                    $(self.__name).not("[app-each]").each(function(){
                        if(!$(this).hasClass('.' + uid)){
                            $(this).remove();
                        }
                    })

                    _.each(clones, function($clone){
                        setTimeout(function(){
                            $clone.insertBefore($el);
                            rivets.init(self.__name, $clone, {});
                            $($clone).show();
                        },0)
                    });

                    t.app.controller.emit("update-iteratable");
                    t.app.controller.emit("update");
                }
            }

            $el.unbind().hide();
            return true;
        }else{
            return false;
        }
    },
    compareObj: function(a, b){
        return JSON.stringify(a) === JSON.stringify(b);
    },
    cloneObj: function(obj){
        return JSON.parse(JSON.stringify(obj));
    },
    twoWayBinding: function ($el, $input, disableUpdate) {
        var self = this;

        disableUpdate = typeof disableUpdate === "undefined" ? false : disableUpdate;
        if(!disableUpdate){
            self.linkUpdateValue($el, $input, disableUpdate);
        }

        t.app.controller.on("update", function () {
            self.linkValueAndOptions($el, $input, this);
        });
        self.linkValueAndOptions($el, $input, t.app.controller);

    },
    linkUpdateValue: function($el, $input){
        var self = this;

        $input.each(function(){
            $input = $(this);
            $input.on("change keyup paste cut", function (e) {
                e.stopPropagation();
                $input = $(this);
                if(!self.preventChangeEvent){
                    $el.each(function(){
                        $el = $(this);
                        setTimeout(function () {
                            var value = self.bindGetValue($input);
                            var keys = false;
                            if($el.hasAttr('app-push-value')){
                                keys = $el.attr('app-push-value');
                                if(keys){
                                    var valKey = t.app.controller.assignProp(keys, value, true);
                                    var setValue = keys + "." + valKey;
                                    $el.attr("app-value", setValue).removeAttr("app-push-value");
                                }
                            }else{
                                if ($el.hasAttr('app-set-value')) {
                                    keys = $el.attr('app-set-value');
                                }else if ($el.hasAttr('app-value')) {
                                    keys = $el.attr('app-value');
                                }
                                if(keys){
                                    t.app.controller.assignProp(keys, value);
                                }
                            }
                            $el.trigger("change");
                        }, 0);
                    })
                }
            });
        })
    },
    linkValueAndOptions: function($el, $input, controller){
        var self = this;
        if ($el.hasAttr('app-options')) {
            var keys = $el.attr('app-options');
            var options = controller.readProp(keys);
            if (options.length) {
                self.bindSetOptions(options, $el);
            }
        }
        if ($el.hasAttr('app-value')) {
            var keys = $el.attr('app-value');
            var value = controller.readProp(keys);
            if (value) {
                self.bindSetValue(value, $el);
            }
        }
    },
    bindGetValue:function($input){
        return $input.val();
    },
    bindSetValue: function(value, $el){
        var self = this;
        self.value = value;
    },
    bindSetOptions: function(options, $el){
        var self = this;
        self.options = options;
    },
    replaceTokenValues: function($el, attrs, token, replaceValue){
        var self = this;
        _.each(attrs, function(attr){
            $el.find("[" + attr + "]").each(function(){
                self.replaceValueToken($(this), attr, token, replaceValue);
            })
        })
    },
    replaceValueToken: function($el, attr, token, replaceValue){
        var value = $el.attr(attr);
        if(typeof value !== "undefined"){
            if(value.indexOf(token) !== -1){
                value = value.split(token).join(replaceValue);
                $el.attr(attr, value);
            }
        }
    },
    validate: function(rules, onComplete){
        t.app.controller.validate(rules, onComplete);
    },
    openModal: function(modal, modalValue){
        t.app.controller.openModal(modal, modalValue)
    },
    closeModal: function(){
        t.app.controller.closeModal();
    }
});

t.libraries.View = Stapes.subclass({

});

t.libraries.Views = Stapes.subclass({
    constructor: function(dir){
        var self = this;
        this.dir = typeof dir !== "undefined" ? dir : defaultViewDir;
        this.staged = [];
        this.views = [];
        this.components = [];
        this.on("views-loaded", function(){
            self.loadAllComponents();
        })
        this.on("components-loaded", function(){
            self.emit("ready");
        })
        this.loadAllViews();
    },
    loadAllViews: function(){
        var preload = typeof t.app.appController.prototype.preload !== "undefined" ? t.app.appController.prototype.preload : true;
        var self = this;
        var views = $("t-views").children("t-view[src]");
        var N = views.length;
        if(N > 0){
            views.each(function(){
                var cont = function(){
                    N -= 1;
                    if(N < 1){
                        self.emit("views-loaded");
                    }
                }
                if(!preload){
                    cont();
                }else{
                    self.include($(this), self.dir, function($el){
                        self.views.push($el.attr("name"));
                        cont();
                    })
                }
            })
        }else{
            self.emit("views-loaded");
        }
    },
    loadAllComponents: function(){
        var self = this;
        var components = $("t-views > t-components").children("t-component[src]");
        var N = components.length;
        if(N > 0){
            components.each(function(){
                self.include($(this), self.dir + "components/", function($el){
                    self.components.push($el.attr("name"));
                    N -= 1;
                    if(N < 1){
                        self.emit("components-loaded");
                    }
                })
            })
        }else{
            self.emit("components-loaded");
        }
    },
    include: function($el, dir, onComplete){
        var self = this;
        var src = $el.attr("src");
        src = dir + src + "?" + Date.now();
        $.get(src, function(html, status){
            var result = status === "error" ? false : true;
            if(html.indexOf("[[t-views-ignore]]") !== -1){
                result = false;
            }

            if(!result){
                console.error("t Cannot include file: " + src);
                onComplete($el, result, html);
            }else{
                html = self.comment(html);
                $el.html(html);
                onComplete($el, result, html);
            }
        })
    },
    comment: function(html){
        html = "<!--[[ " + html + " ]]-->";
        return html;
    },
    uncomment: function(html){
        html = typeof html !== "undefined" ? html : "";
        html = html.replace("<!--[[ ", "");
        html = html.replace(" ]]-->", "");
        return html;
    },
    registerAllComponents: function(){
        return this.registerComponents(this.components);
    },
    refreshComponents: function($el){
        $("html").find("[t-component]").each(function(){
            var name = $(this).attr("t-component");
            rivets.components[name].initialize(this);
        })
    },
    registerComponents: function(components){
        var self = this;
        _.each(components, function(name){
            var $component = $('t-components > t-component[name="' + name + '"]');
            self.registerComponent($component, name);
        })
    },
    registerComponent: function($component, name){
        var self = this;

        rivets.components[name] = {
            template: function(){
                return self.uncomment($component.html());
            },
            initialize: function(el){
                var $el = $(el).attr("t-component", name);
                var attributes = self.getAttributes($el);
                var controllerName = self.componentControllerName(name);
                if(typeof t.components[controllerName].proto === "function"){
                    t.components[controllerName].proto({
                        __name: name
                    });
                }
                var componentController = typeof t.components[controllerName] !== "undefined" ? new t.components[controllerName]($el, attributes) : new t.libraries.Component($el, attributes);

                return componentController;
            }
        }

    },
    getAttributes: function($el){
        var attributes = {};
        $el.each(function(){
            $.each(this.attributes, function(){
                if(this.specified){
                    attributes[this.name] = this.value;
                }
            })
        });
        return attributes;
    },
    componentControllerName: function(name){
        var parts = name.split("-");
        _.each(parts, function(part, key){
            if(key > 0){
                parts[key] = part.charAt(0).toUpperCase() + part.slice(1);
            }
        })
        return parts.join("");
    },
    stage: function($viewEl, controller, show, hide, callback){
        var self = this;
        show = typeof show !== "function" ? controller.show : show;
        hide = typeof hide !== "function" ? controller.hide : hide;
        var preload = typeof t.app.appController.preload !== "undefined" ? t.app.appController.preload : true;

        var cont = function($view){
            var html = $view.html();
            html = self.uncomment(html);

            var name = $view.attr("name") + "-view";

            if($(name).exists()){
                var stagedID = parseInt($(name).attr("data-staged-id"));
                $(name).remove();
                self.staged[stagedID] = null;
            }

            var stagedID = self.staged.length;
            $view = $("<" + name + "/>").attr({
                "class": "view",
                "data-staged-id": stagedID
            }).html(html).hide();

            var view = new (t.libraries.View.subclass({
                id: stagedID,
                name: name,
                $view: $view,
                controller: controller,
                show: show,
                hide: hide
            }));

            view.$view.appendTo("t-canvas");

            self.staged.push(view);

            callback(view)
        }
        if(!preload){
            self.include($viewEl, self.dir, function($el){
                self.views.push($el.attr("name"));
                cont($el);
            })
        }else{
            cont($viewEl);
        }
    },
    show: function(view){
        this.hideOthers(view);
        t.app.emit("view-show");
        view.show();
    },
    hideOthers: function(view){
        t.app.emit("view-hide");
        _.each(this.staged, function(View){
            if(View !== null){
                if(view.name !== View.name){
                    View.hide();
                }
            }
        });
    }
})

t.libraries.Controller = Stapes.subclass({
    __name: "app",
    ready: function(){

    },
    render: function(viewID, onShow, onHide){
        var self = this;
        t.app.setTitles(this.title ? this.title : t.app.appController.title, this.subTitle ? this.subTitle : t.app.appController.subTitle);
        t.app.setMetaDesc(this.metaDesc ? this.metaDesc : t.app.appController.metaDesc);
        var $view = $('t-views > t-view[name="' + viewID + '"]');
        t.app.Views.stage($view, self, onShow, onHide, function(view){
            rivets.bind(view.$view, self);
            t.app.Views.show(view);
        });
    },
    show: function(){
        this.$view.fadeIn();
    },
    hide: function(){
        this.$view.fadeOut();
    },
    showLoading: function(){
        t.app.showLoading();
    },
    hideLoading: function(){
        t.app.hideLoading();
    },
    loaded: function(){
        if (typeof t.app.router.state.value !== "undefined") {
            if (ga) {
                ga('send', 'event', 'Detailed Page View', 'View', t.app.router.state.value);
            }
        }
        if (!this.orientation) {
            $('t-canvas').addClass('orientation');
        }else{
            $('t-canvas').removeClass('orientation');
        }
        this.hideLoading();
        this.update();
        this.emit("loaded", [this]);
    },
    update: function(){
        this.hideLoading();
        this.emit("update", [this]);
    },
    _construct: function(controller, args){
        function Controller() {
            return controller.apply(this, args);
        }
        Controller.prototype = controller.prototype;
        return new Controller();
    },
    goTo: function(controller, method, args){
        t.app.goTo(controller, method, args);
    },
    back: function(e, self){
        t.app.back();
        return false;
    },
    navigateTo: function(e, self){
        var href = $(this).attr("href");
        t.app.navigate(href);
        return false;
    },
    navigate: function(route, showLoading){
        t.app.navigate(route, showLoading);
        return true;
    },
    expandSearch: function(e, context){
        var self = $(this).parents('app-input');
        var logo = $(document).find('#topLogo');
        if (!self.toggleClass('hidden').hasClass('hidden')) {
            logo.velocity({opacity:0}, {duration:300});
            self.find(' > label').show().velocity({opacity:1}, {duration:500, complete:function(){
                self.find(' > label > input').focus();
                }})
        }else{
            self.find(' > label').velocity({opacity:0}, {duration:500, complete:function(){
                $(this).hide();
                logo.velocity({opacity:1}, {duration:300});
                }})
        }
        return false;
    },
    doSearch: function(e, context){

        t.app.showLoading();
        t.app.navigate("/search/" + encodeURIComponent( $(this).parents('app-input').find('input').val() ) );

    },
    parseProp: function(prop){
        if (typeof prop === "string"){
            prop = prop.split("'").join("\"");
            prop = Papa.parse($.trim(prop), { header: false, delimiter: "." }).data;
            if(prop.length){
                prop = prop[0];
            }else{
                prop = [];
            }
            _.each(prop, function(p, k){
                prop[k] = prop[k].split('"').join("");
            })
        }
        return prop;
    },
    readProp: function(prop){
        var self = this;

        if((prop.indexOf("[") !== -1) || (prop.indexOf("]") !== -1)){
            return false;
        }
        var prop = self.parseProp(prop);
        var result = self;
        _.each(prop, function(key){
            if(result[key]){
                result = result[key];
            }else{
                result = "";
            }
        });
        return result;
    },
    assignProp: function(prop, value, push, obj){
        var self = this;
        obj = typeof obj === "undefined" ? self : obj;
        push = typeof push === "undefined" ? false : push;

        if((prop.indexOf("[") !== -1) || (prop.indexOf("]") !== -1)){
            return false;
        }
        var prop = self.parseProp(prop);
        if(prop.length > 0){
            var propLength = prop.length - 1;
            var i = 0;
            var key = prop[i];

            if(typeof obj[key] === "undefined"){
                if(propLength > 0){
                    obj[key] = {};
                    if(push && i === propLength - 1){
                        obj[key] = [];
                    }
                    prop.shift();
                    self.assignProp(prop, value, push, obj[key]);
                    prop = [];
                }else{
                    if(!push){
                        if(value !== null){
                            obj[key] = value;
                        }
                    }else{
                        obj[key] = [];
                        obj[key].push(value);
                    }
                }
            }else{
                if(propLength > 0){
                    prop.shift();
                    self.assignProp(prop, value, push, obj[key]);
                    prop = [];
                }else{
                    if(!push){
                        if(value !== null){
                            obj[key] = value;
                        }else{
                            delete obj[key];
                        }
                    }else{
                        obj[key].push(value);
                    }
                }
            }
        }

    },
    validate: function(rules, onComplete){
        var self = this;
        if(rules instanceof jQuery){
            if(rules.hasAttr("app-validate")){
                var rulesKey = rules.attr("app-validate");
                rules = self.readProp(rulesKey);
            }else{
                rules = false;
            }
        }

        var validated = true;
        if(rules){
            validated = _.every(rules, function(rule, key){
                return self.validateRule(rule, key, onComplete);
            })
        }
        if(validated){
            onComplete(false);
            return true;
        }else{
            return false;
        }
    },
    validateRule: function(rule, key, onComplete){
        var self = this;
        var value = self.readProp(key);
        var message = typeof rule.message === "undefined" ? "Field " + key.split(".").pop() + " is not valid." : rule.message;
        if(rule.required){
            if(is.empty(value)){
                onComplete({ message: message, type: "required", value: value });
                return false;
            }
        }
        if(rule.type){
            var type = rule.type;
            var skip = false;
            if(!rule.required && !value){
                skip = true;
            }
            if(!skip){
                if(type === "number" || type === "integer"){
                    value = parseInt(value);
                }
                if(type === "decimal"){
                    value = parseFloat(value);
                }
                if(is.not[type](value)){
                    onComplete({ message: message, type: type, value: value });
                    return false;
                }
            }
        }
        if(rule.matches){
            var matchValue = self.readProp(rule.matches);
            if(value !== matchValue){
                onComplete({ message: message, type: "matches '" + matchValue + "'", value: value });
                return false;
            }
        }
        if(rule.min){
            if(is.under(value.length, rule.min)){
                onComplete({ message: message, type: "min", value: value });
                return false;
            }
        }
        if(rule.max){
            if(is.above(value.length, rule.max)){
                onComplete({ message: message, type: "max", value: value });
                return false;
            }
        }
        if(rule.validate){
            try{
                var valid = rule.validate.call(self, value, rule);
                if(!valid){
                    onComplete({ message: message, type: "validate", value: value });
                    return false;
                }
            }catch(err){
                onComplete(err);
                return false;
            }
        }
        if(rule.each && typeof value === "object"){
            return _.every(value, function(obj, objKey){
                if(obj){
                    return _.every(rule.each, function(eachRule, eachKey){
                        var testKey = key + "." + objKey + "." + eachKey;
                        return self.validateRule(eachRule, testKey, onComplete);
                    });
                }else{
                    return true;
                }
            });
        }
        return true;
    },
    openModal: function(modal, modalValue){
        var $modal = $('<app-modal-' + modal + '/>');
        if(modalValue){
            $modal.attr({
                "app-value": modalValue
            });
        }
        rivets.init('app-modal-' + modal, $modal, {});
        $('t-modal').append($modal).velocity('transition.fadeIn', {duration:300});
    },
    closeModal: function(){
        $('t-modal').velocity('transition.fadeOut', { duration:300 });
        setTimeout(function(){ $('t-modal').find('*').remove() }, 250);
    }
})

t.libraries.Model = Stapes.subclass({
    constructor: function(data){
        if(typeof data === "object"){
            this.extend(data);
        }
    }
});

t.libraries.Collection = Stapes.subclass({
    objects: [],
    adapter: function(){
        return {};
    },
    constructor: function(model){
        this.model = model;
        this.adapter = typeof this.adapter === "function" ? this.adapter() : this.adapter;
        this.clear();
    },
    clear: function(){
        this.objects = [];
        return this;
    },
    pull: function(conditions){
        return _.findWhere(this.objects, conditions);
    },
    create: function(data, push){
        push = typeof push === "undefined" ? true : push;
        var object = new this.model(data);
        if(push){
            this.objects.push(object);
        }
        return object;
    },
    createObjects: function(items, empty){
        empty = typeof empty === undefined ? true : empty;
        var self = this;
        if(empty){
            this.objects = [];
        }
        _.each(items, function(item){
            self.create(item);
        })
    },
    query: function(method, data, callback, post){
        var self = this;
        if(typeof this.adapter.query === "function" ){
            this.adapter.query(method, data, function(data){
                self.callback("query", callback, data);
            }, post);
        }else{
            this.callback("query", callback);
        }
    },
    get: function(onComplete, conditions){
        var self = this;
        if(typeof this.adapter.get === "function" ){
            this.adapter.get(function(data){
                if(data !== false){
                    var object = self.create(data, false);
                    self.callback("get", onComplete, object);
                }else{
                    self.callback("get", onComplete);
                }
            }, conditions)
        }else{
            this.callback("get", onComplete);
        }
        return this;
    },
    getAll: function(onComplete, conditions){
        var self = this;
        if(typeof this.adapter.getAll === "function" ){
            this.adapter.getAll(function(data){
                if(data !== false){
                    self.clear();
                    self.createObjects(data);
                    self.callback("getAll", onComplete, self.objects);
                }else{
                    self.callback("getAll", onComplete);
                }
            }, conditions)
        }else{
            this.callback("getAll", onComplete);
        }
        return this;
    },
    callback: function(event, callback, data){
        if(typeof callback === "function"){
            callback(data);
        }
        this.emit(event, data);
    },
    empty: function(){
        if(typeof this.objects === "undefined"){
            return true;
        }else if(this.objects.length < 1){
            return true;
        }else{
            return false;
        }
    }
});

t.libraries.Adapters.jsonFile = Stapes.subclass({
    src: "",
    localCache: false,
    constructor: function(src){
        this.src = src;
    },
    get: function(callback, conditions){
        var pullNew = true;
        if(this.localCache !== false){
            if(typeof conditions !== "undefined"){
                var data = _.findWhere(this.localCache, conditions);
            }else{
                var data = this.localCache;
            }
            if(typeof data !== "undefined"){
                pullNew = false;
                callback(data);
            }
        }
        if(pullNew){
            $.ajax({
                dataType: "json",
                url: this.src  + "?" + Date.now(),
                async: true,
                success: function(data){
                    if(typeof conditions !== "undefined"){
                        data = _.findWhere(data, conditions);
                        data = typeof data === "undefined" ? false : data;
                    }else{
                        data = data[0];
                    }
                    callback(data);
                },
                error: function(){
                    callback(false);
                }
            })
        }
    },
    getAll: function(callback, conditions){
        var self = this;
        $.ajax({
            dataType: "json",
            url: this.src  + "?" + Date.now(),
            async: true,
            success: function(data){
                if(typeof conditions !== "undefined"){
                    data = _.where(data, conditions);
                }
                self.localCache = data;
                callback(data);
            },
            error: function(){
                callback(false);
            }
        })
    }
})

t.libraries.Adapters.jsonService = Stapes.subclass({
    src: "",
    constructor: function(src){
        // ToDo: Check for trailing slash
        this.src = t.app.appController.service.host + "/" + src + "/";
    },
    query: function(method, conditions, callback, post){
        post = typeof post === "undefined" ? false : post;
        conditions = typeof conditions !== "object" ? {} : conditions;

        if(!post){
            conditions['__nocache__'] = Date.now();
        }
        $.ajax({
            method: post ? "POST" : "GET",
            dataType: "json",
            url: this.src  + method + (post ? "?__nocache__=" + Date.now() : ""),
            xhrFields: { withCredentials: true },
            async: true,
            data: conditions,
            success: function(data){
                callback(data);
            },
            error: function(data){
                callback(false);
            }
        })
    },
    get: function(callback, conditions){
        this.query("get", conditions, function(data){
            if(data){
                callback(data);
            }else{
                callback(false);
            }
        })
    },
    getAll: function(callback, conditions){
        this.query("getAll", conditions, function(data){
            if(data){
                callback(data);
            }else{
                callback(false);
            }
        })
    }
})

t.libraries.Adapters.socket = Stapes.subclass({
    host: "",
    socket: false,
    modelName: "",
    constructor: function(modelName, forceNew){
        this.host = t.app.appController.socket.host;
        this.modelName = modelName;
        forceNew = typeof forceNew === "undefined" ? false : forceNew;
        var options = {};
        if(t.app.appController.socket.path){
            options.path = t.app.appController.socket.path;
        }
        if(forceNew){
            t.app.socket = io(this.host, options);
        }else{
            t.app.socket = typeof t.app.socket === "undefined" ? io(this.host, options) : t.app.socket;
        }
        this.socket = t.app.socket;
    },
    query: function(method, data, callback){
        this.refreshConnection();
        var request = {
            data: data
        };
        request.action = this.modelName + ":" + method;
        this.socket.removeAllListeners(request.action);
        this.socket.emit(request.action, request);
        this.socket.on(request.action, function(response){
            callback(response);
        });
    },
    get: function(callback, conditions){
        var pullNew = true;
        callback(true);
    },
    getAll: function(callback, conditions){
        callback(true);
    },
    refreshConnection: function(){
        var options = {'forceNew':true };
        if(t.app.appController.socket.path){
            options.path = t.app.appController.socket.path;
        }
        t.app.socket = io(this.host, options);
        this.socket = t.app.socket;
    }
})
