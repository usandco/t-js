$.fn.exists = function() {
    return this.length > 0;
}

$.fn.hasAttr = function(name) {  
   var attr = this.attr(name);
   return typeof attr !== 'undefined' && attr !== false;
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
    },
    showLoading: function(){
        $("t-loading").show().velocity({ opacity: 1 }, { duration: 800 });
    },
    hideLoading: function(){
        $("t-loading").velocity({ opacity: 0 }, { duration: 800, display: "none" });
    },
    init: function(){
        var self = this;
        this.loadViews();
        this.bodyFix();
        this.appController = new this.appController(self);
        this.bindControllerToPage(this.appController);
        this.initCollections();
        this.Views.on("ready", function(){
            self.Views.registerAllComponents();
            self.bindControllerToPage(self.appController);
            self.initRouter();
            self.appController.ready(self);
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
        this.controller[method].apply(t.app.controller, args);
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
        showLoading = typeof showLoading !== "undefined" ? showLoading : true;
        if(showLoading){
            this.showLoading();
        }
        this.router.navigate(route);
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
    }
});

t.libraries.Component = Stapes.subclass({
    attr: {},
    constructor: function($el, attrs){
        this.attr = attrs;
    },
    onClick: function(e, self){
        e.stopPropagation();
        var el = this;
        var event = typeof self.attr['t-on-click'] !== "undefined" ? self.attr['t-on-click'] : false;
        if(event){
            t.app.controller[event].apply(el, [e, t.app.controller]);
            return false;
        }
    },
    navigateTo: function(e, self){
        var href = $(this).attr("href");
        t.app.navigate(href);
        return false;
    }
});

t.libraries.View = Stapes.subclass({
    
});
    
t.libraries.Views = Stapes.subclass({
    constructor: function(dir){
        var self = this;
        this.dir = typeof dir !== "undefined" ? dir : "app/views/";
        this.staged = [];
        this.views = [];
        this.components = [];
        this.loadAllViews();
        this.on("views-loaded", function(){
            self.loadAllComponents();
        })
        this.on("components-loaded", function(){
            self.emit("ready");
        })
        
    },
    loadAllViews: function(){
        var self = this;
        var views = $("t-views").children("t-view[src]");
        var N = views.length;
        if(N > 0){
            views.each(function(){
                self.include($(this), self.dir, function($el){
                    self.views.push($el.attr("name"));
                    N -= 1;
                    if(N < 1){
                        self.emit("views-loaded");
                    }
                })
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
            if(!result){
                console.error("t Cannot include file: " + src);
            }else{
                html = self.comment(html);
                $el.html(html);
            }
            onComplete($el, result, html);
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
                var $el = $(el);
                var attributes = self.getAttributes($el);

                var controllerName = self.componentControllerName(name);
                var componentController = typeof t.components[controllerName] !== "undefined" ? new t.components[controllerName]($el, attributes) : new t.libraries.Component($el, attributes);
                
                return componentController;
            }
        }
    },
    getAttributes: function($el){
        var attributes = [];
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
    stage: function($view, controller, show, hide){
        show = typeof show !== "function" ? controller.show : show;
        hide = typeof hide !== "function" ? controller.hide : hide;
        
        var html = $view.html();
        html = this.uncomment(html);
        
        var name = $view.attr("name") + "-view";
        
        if($(name).exists()){
            var stagedID = parseInt($(name).attr("data-staged-id"));
            $(name).remove();
            this.staged[stagedID] = null;
        }
        
        var stagedID = this.staged.length;
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
        
        this.staged.push(view);
        
        return view;
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
        var $view = $('t-views > t-view[name="' + viewID + '"]');
        var view = t.app.Views.stage($view, this, onShow, onHide);
        rivets.bind(view.$view, this);
        t.app.Views.show(view);
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
        window.history.go(-1);
        return false;
    },
    navigateTo: function(e, self){
        var href = $(this).attr("href");
        t.app.navigate(href);
        return false;
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
    query: function(method, data, callback){
        var self = this;
        if(typeof this.adapter.query === "function" ){
            this.adapter.query(method, data, function(data){
                self.callback("query", callback, data);
            });
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

t.libraries.Adapters.socket = Stapes.subclass({
    host: "",
    socket: false,
    modelName: "",
    constructor: function(modelName, forceNew){
        this.host = t.app.appController.socketHost;
        this.modelName = modelName;
        forceNew = typeof forceNew === "undefined" ? false : forceNew;
        
        if(forceNew){
            t.app.socket = io(this.host);
        }else{
            t.app.socket = typeof t.app.socket === "undefined" ? io(this.host) : t.app.socket;
        }
        this.socket = t.app.socket;
    },
    query: function(method, data, callback){
        var request ={
            data: data
        } ;
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
    }
})