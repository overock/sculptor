var Sculptor = (function() {
    var IMG_TYPES = [
        'image/bmp',
        'image/gif',
        'image/jpeg',
        'image/pjpeg',
        'image/png',
        'image/x-icon'
    ], DEF_VIEWPORT_SIZE = 256;
    
    var Sculptor = function(elem, width, height) {
        //DOMs
        this.panel = null;
        this.viewport = document.createElement('div');
        this.source = document.createElement('img');
        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d');
        //coords
        this.viewsize = { w: 256, h: 256 };
        this.srcsize = { w: undefined, h: undefined };
        this.offset = { x: 0, y: 0 };
        this.ratio = 1;
        this.angle = 0;
        // options
        this.expType = null;
        this.canDrop = true;
        // context flags
        this.isRendered = false;
        //this.touchCount = 0;
        
        this.viewport.style.position = 'absolute';
        this.viewport.style.overflow = 'visible';
        this.viewport.style.border = 'solid 1px #aaa';
        this.viewport.addEventListener('mousedown', this._mousedown.bind(this));
        this.viewport.addEventListener('dragover', this._dragover.bind(this));
        this.viewport.addEventListener('drop', this._drop.bind(this));
        this.viewport.addEventListener('touchstart', this._touchstart.bind(this));

        this.source.style.position = 'absolute';
        this.source.style.opacity = 0.2;
        this.source.setAttribute('crossOrigin', 'anonymous');   // prevents canvas from 'tainted' by cross-origin data
        this.source.addEventListener('load', this._load.bind(this));

        this.canvas.style.position = 'absolute';
        
        this.viewport.appendChild(this.source);
        this.viewport.appendChild(this.canvas);

        elem && this.attachToPanel(elem);
        this.setViewport(width || DEF_VIEWPORT_SIZE, height || width || DEF_VIEWPORT_SIZE);
    };

    Sculptor.prototype.attachToPanel = function(elem) {
        this.detachFromPanel();

        if(typeof elem === 'string') { elem = document.querySelector(elem); }
        if(!(elem instanceof HTMLDivElement)) { throw new Error('oops!'); }
        
        this.panel = elem;
        this.panel.appendChild(this.viewport);
        
        this.viewport.style.left = this.panel.offsetWidth>>1 - this.viewsize.w>>1 + 'px';
        this.viewport.style.top = this.panel.offsetHeight>>1 - this.viewsize.h>>1 + 'px';
    };

    Sculptor.prototype.detachFromPanel = function() {
        if(!this.panel) { return; }
        this.source.src = '#';
        this.panel.removeChild(this.viewport);
        this.panel = null;
    };

    Sculptor.prototype.load = function(url) {
        this.source.src = url;
    };

    Sculptor.prototype.export = function(q) {
        return this._export(q || 1);    // q 상태를 저장해 두어야 할 필요가 있을까?
    };
    
    Sculptor.prototype.exportBySize = function(g /*in bytes*/) {
        var M = 1, q = 0.87, m=0, result = this._export(1);
        g = g || Infinity;

        if(result.length>g) for(var i=0; i<5 || result.length>g; ++i) {
            result = this._export(q);
            result.length<g? (m = q) : (M = q);
            q = (M + m)/2;
        }
        return result;
    };
    
    Sculptor.prototype.setViewport = function(width, height) {
        var offsetX = (this.viewsize.w - width)>>1,
            offsetY = (this.viewsize.h - height)>>1;

        this.offset.x -= offsetX;
        this.offset.y -= offsetY;
        this.viewport.style.left = this.viewport.offsetLeft + offsetX + 'px';
        this.viewport.style.top = this.viewport.offsetTop + offsetY + 'px';
        this.viewport.style.width = (this.canvas.width = this.viewsize.w = width) + 'px';
        this.viewport.style.height = (this.canvas.height = this.viewsize.h = height) + 'px';

        this._render();
    };
    
    Sculptor.prototype.zoom = function(z) {
        if(!this.isRendered) { return; }
        var oR = this.ratio;

        this.ratio = z || 1;
        this.offset.x += this.srcsize.w*(oR - this.ratio)>>1;
        this.offset.y += this.srcsize.h*(oR - this.ratio)>>1;

        this._render();
    };
    
    Sculptor.prototype.setEncoding = function(s) {
        this.expType = IMG_TYPES.find(function(v) { return v.indexOf(s)>=0; }) || null;
    };
    
    Sculptor.prototype.setDropMode = function(b) {
        this.canDrop = !!b;
    };
    
    //**************************************************************************
    Sculptor.prototype._load = function() {
        this.isRendered = false; // entering critical section, huh?
        this.source.style.width = '';
        this.source.style.height = '';
        this.srcsize = { w: this.source.width, h: this.source.height };

        this.ratio = 0;
        this._validateZoom();
        
        
        this.source.style.left = (this.offset.x = (this.viewsize.w - this.srcsize.w*this.ratio)>>1) + 'px';
        this.source.style.top = (this.offset.y = (this.viewsize.h - this.srcsize.h*this.ratio)>>1) + 'px';

        this._render();
    };

    Sculptor.prototype._mousedown = function(e) {
        e.preventDefault();
        e.stopPropagation();

        var startX = e.clientX,
            startY = e.clientY,
            oldX = this.offset.x,
            oldY = this.offset.y,
            move = function(e) {
                e.preventDefault();
                e.stopPropagation();

                this.offset.x = oldX + e.clientX - startX;
                this.offset.y = oldY + e.clientY - startY;
                this._render();
            }.bind(this),
            up = function() {
                window.removeEventListener('mousemove', move);
                window.removeEventListener('mouseup', up);
            }.bind(this);

        window.addEventListener('mousemove', move);
        window.addEventListener('mouseup', up);
    };

    Sculptor.prototype._dragover = function(e) {
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = this.canDrop? 'copy' : 'none';
    };

    Sculptor.prototype._drop = function(e) {
        e.preventDefault();
        e.stopPropagation();
        
        if(!this.canDrop) { return false; }

        var f = e.dataTransfer.files[0];
        if(f.type.indexOf('image')>=0) {
            var fr = new FileReader();
            fr.onload = function(e) {
                this.source.src = e.target.result;
                this.srcType = e.target.type;
            }.bind(this);
            fr.readAsDataURL(f);
        } else {
            alert('only image files allowed!');
        }
    };
    
    Sculptor.prototype._touchstart = function(e) {
        console.log(e.touches);
    };

    Sculptor.prototype._render = function() {
        this._validateZoom();
        this._validateOffset();
        this.source.style.left = this.offset.x + 'px';
        this.source.style.top = this.offset.y + 'px';
        this.source.style.width = this.srcsize.w*this.ratio + 'px';
        this.source.style.height = this.srcsize.h*this.ratio + 'px';
        this.source.style.transform = 'rotate(' + this.angle + 'deg)';
        
        this.ctx.save();
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.scale(this.ratio, this.ratio);
        this.ctx.rotate(this.angle*Math.PI/180);
        this.ctx.drawImage(this.source, this.offset.x/this.ratio, this.offset.y/this.ratio);
        this.ctx.restore();
        
        this.isRendered = true;
    };

    Sculptor.prototype._export = function(q) {
        return this.canvas.toDataURL(this.expType || this.srcType, q);
    };

    Sculptor.prototype._toOctetStream = function(url) {
        return url.replace(/image\/.+;/, 'image/octet-stream;');
    };

    Sculptor.prototype._validateZoom = function() {
        this.ratio = Math.max.apply(null, [this.ratio, this.viewsize.w/this.srcsize.w, this.viewsize.h/this.srcsize.h]);
    };

    Sculptor.prototype._validateOffset = function() {
        this.offset.x = Math.max(this.viewsize.w - this.srcsize.w*this.ratio, Math.min(0, this.offset.x));
        this.offset.y = Math.max(this.viewsize.h - this.srcsize.h*this.ratio, Math.min(0, this.offset.y));
    };
    
    return Sculptor;
})();

typeof module !== 'undefined' && (module.exports = Sculptor);