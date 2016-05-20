TIPS

    /** EVENT **/
    template.ready(function(object){
        if(object.hasAttr('destroy')){
            object.destroy()
        }
    })

    
    /** EVENT **/
    template.ready(function(object){
        if(!object.hasAttr('stop')){
            object.children().hide();    
        }
        
        object.fadeIn();
    })
