/* ************************************************************************

   qooxdoo - the new era of web development

   http://qooxdoo.org

   Copyright:
     2004-2012 1&1 Internet AG, Germany, http://www.1und1.de

   License:
     LGPL: http://www.gnu.org/licenses/lgpl.html
     EPL: http://www.eclipse.org/org/documents/epl-v10.php
     See the LICENSE file in the project's top-level directory for details.

   Authors:
     * Martin Wittemann (martinwittemann)
     * Tino Butz (tbtz)
     * Christian Hagendorn (chris_schmidt)
     * Daniel Wagner (danielwagner)

************************************************************************ */

/**
 * Listens for native touch events and fires composite events like "tap" and
 * "swipe"
 *
 * @ignore(qx.event.*)
 */
qx.Bootstrap.define("qx.event.handler.TouchCore", {

  extend : Object,

  statics :
  {
    /** @type {Integer} The maximum distance of a tap. Only if the x or y distance of
     *      the performed tap is less or equal the value of this constant, a tap
     *      event is fired.
     */
    TAP_MAX_DISTANCE : qx.core.Environment.get("os.name") != "android" ? 10 : 40,


    /** @type {Map} The direction of a swipe relative to the axis */
    SWIPE_DIRECTION :
    {
      x : ["left", "right"],
      y : ["up", "down"]
    },


    /** @type {Integer} The minimum distance of a swipe. Only if the x or y distance
     *      of the performed swipe is greater as or equal the value of this
     *      constant, a swipe event is fired.
     */
    SWIPE_MIN_DISTANCE : qx.core.Environment.get("os.name") != "android" ? 11 : 41,

    /** @type {Integer} The minimum velocity of a swipe. Only if the velocity of the
     *      performed swipe is greater as or equal the value of this constant, a
     *      swipe event is fired.
     */
    SWIPE_MIN_VELOCITY : 0,


    /**
     * @type {Integer} The time delta in milliseconds to fire a long tap event.
     */
    LONGTAP_TIME : 500
  },


  /**
   * Create a new instance
   *
   * @param target {Element} element on which to listen for native touch events
   * @param emitter {qx.event.Emitter} Event emitter object
   */
  construct : function(target, emitter)
  {
    this.__target = target;
    this.__emitter = emitter;
    this._initTouchObserver();
  },


  members :
  {
    __target : null,
    __emitter : null,
    __onTouchEventWrapper : null,

    __originalTarget : null,

    __startPageX : null,
    __startPageY : null,
    __startTime : null,
    __isSingleTouchGesture : null,
    __isTapGesture : null,
    __onMove : null,

    __beginScalingDistance : null,
    __beginRotation : null,

    __longTapTimer : null,


    /*
    ---------------------------------------------------------------------------
      OBSERVER INIT
    ---------------------------------------------------------------------------
    */

    /**
     * Initializes the native touch event listeners.
     */
    _initTouchObserver : function()
    {
      this.__onTouchEventWrapper = qx.lang.Function.listener(this._onTouchEvent, this);

      var Event = qx.bom.Event;

      Event.addNativeListener(this.__target, "touchstart", this.__onTouchEventWrapper);
      Event.addNativeListener(this.__target, "touchmove", this.__onTouchEventWrapper);
      Event.addNativeListener(this.__target, "touchend", this.__onTouchEventWrapper);
      Event.addNativeListener(this.__target, "touchcancel", this.__onTouchEventWrapper);

      if (qx.core.Environment.get("event.mspointer")) {
        Event.addNativeListener(this.__target, "MSPointerDown", this.__onTouchEventWrapper);
        Event.addNativeListener(this.__target, "MSPointerMove", this.__onTouchEventWrapper);
        Event.addNativeListener(this.__target, "MSPointerUp", this.__onTouchEventWrapper);
        Event.addNativeListener(this.__target, "MSPointerCancel", this.__onTouchEventWrapper);
      }
    },



    /*
    ---------------------------------------------------------------------------
      OBSERVER STOP
    ---------------------------------------------------------------------------
    */

    /**
     * Disconnects the native touch event listeners.
     */
    _stopTouchObserver : function()
    {
      var Event = qx.bom.Event;

      Event.removeNativeListener(this.__target, "touchstart", this.__onTouchEventWrapper);
      Event.removeNativeListener(this.__target, "touchmove", this.__onTouchEventWrapper);
      Event.removeNativeListener(this.__target, "touchend", this.__onTouchEventWrapper);
      Event.removeNativeListener(this.__target, "touchcancel", this.__onTouchEventWrapper);

      if (qx.core.Environment.get("event.mspointer")) {
        Event.removeNativeListener(this.__target, "MSPointerDown", this.__onTouchEventWrapper);
        Event.removeNativeListener(this.__target, "MSPointerMove", this.__onTouchEventWrapper);
        Event.removeNativeListener(this.__target, "MSPointerUp", this.__onTouchEventWrapper);
        Event.removeNativeListener(this.__target, "MSPointerCancel", this.__onTouchEventWrapper);
      }
    },



    /*
    ---------------------------------------------------------------------------
      NATIVE EVENT OBSERVERS
    ---------------------------------------------------------------------------
    */

    /**
     * Handler for native touch events.
     *
     * @param domEvent {Event} The touch event from the browser.
     */
    _onTouchEvent : function(domEvent)
    {
      this._commonTouchEventHandler(domEvent);
    },


    /**
     * Calculates the scaling distance between two touches.
     * @param touch0 {Event} The touch event from the browser.
     * @param touch1 {Event} The touch event from the browser.
     * @return {Number} the calculated distance.
     */
    _getScalingDistance: function(touch0, touch1) {
      return(Math.sqrt( Math.pow(touch0.pageX - touch1.pageX, 2) + Math.pow(touch0.pageY - touch1.pageY, 2) ));	
    },


    /**
     * Calculates the rotation between two touches.
     * @param touch0 {Event} The touch event from the browser.
     * @param touch1 {Event} The touch event from the browser.
     * @return {Number} the calculated rotation.
     */
    _getRotationAngle: function(touch0, touch1) {
      var x = touch0.pageX - touch1.pageX;
      var y = touch0.pageY - touch1.pageY;
      return(Math.atan2(y, x)*180/Math.PI);	
    },


    /**
     * Called by an event handler.
     *
     * @param domEvent {Event} DOM event
     * @param type {String ? null} type of the event
     */
    _commonTouchEventHandler : function(domEvent, type)
    {
      var type = type || domEvent.type;
      if (qx.core.Environment.get("event.mspointer")) {
        domEvent.changedTouches = [domEvent];
        domEvent.targetTouches = [domEvent];
        domEvent.touches = [domEvent];

        if(type == "MSPointerDown") {
          type = "touchstart"
        } else if (type == "MSPointerUp") {
          type = "touchend";
        } else if(type == "MSPointerMove") {
          if (this.__onMove == true) {
            type = "touchmove";
          }
        } else if(type == "MSPointerCancel") {
          type = "touchcancel";
        }
      }

      if (type == "touchstart") {
        this.__originalTarget = this._getTarget(domEvent);

        this.__isTapGesture = true;

        if(domEvent.touches && domEvent.touches.length > 1) {
          this.__beginScalingDistance = this._getScalingDistance(domEvent.touches[0],domEvent.touches[1]);
          this.__beginRotation = this._getRotationAngle(domEvent.touches[0],domEvent.touches[1]);
        }
      }

      if(type =="touchmove") {
        // Polyfill for scale 
        if(typeof domEvent.scale == "undefined" && domEvent.changedTouches.length > 1) {

          var currentScalingDistance = this._getScalingDistance(domEvent.changedTouches[0],domEvent.changedTouches[1]);
          domEvent.scale = currentScalingDistance / this.__beginScalingDistance;
        }

         // Polyfill for rotation 
        if(typeof domEvent.rotation == "undefined" && domEvent.changedTouches.length > 1) {
          var currentRotation = this._getRotationAngle(domEvent.changedTouches[0],domEvent.changedTouches[1]);
          domEvent.rotation = currentRotation - this.__beginRotation;
        }

        if (this.__isTapGesture) {
          this.__isTapGesture = this._isBelowTapMaxDistance(domEvent.changedTouches[0]);
        }
      }

      this._fireEvent(domEvent, type);
      this.__checkAndFireGesture(domEvent, type);
    },


    /**
     * Checks if the distance between the x/y coordinates of "touchstart" and "touchmove" event
     * exceeds TAP_MAX_DISTANCE and returns the result.
     *
     * @param touch {Event} The "touchmove" event from the browser.
     * @return {Boolean} true if distance is below TAP_MAX_DISTANCE.
     */
    _isBelowTapMaxDistance: function(touch) {
      var deltaCoordinates = {
        x: touch.screenX - this.__startPageX,
        y: touch.screenY - this.__startPageY
      };

      var clazz = qx.event.handler.TouchCore;

      return (Math.abs(deltaCoordinates.x) <= clazz.TAP_MAX_DISTANCE &&
              Math.abs(deltaCoordinates.y) <= clazz.TAP_MAX_DISTANCE);
    },


    /*
    ---------------------------------------------------------------------------
      HELPERS
    ---------------------------------------------------------------------------
    */

    /**
     * Return the target of the event.
     *
     * @param domEvent {Event} DOM event
     * @return {Element} Event target
     */
    _getTarget : function(domEvent)
    {
      var target = qx.bom.Event.getTarget(domEvent);

      // Text node. Fix Safari Bug, see http://www.quirksmode.org/js/events_properties.html
      if (qx.core.Environment.get("engine.name") == "webkit")
      {
        if (target && target.nodeType == 3) {
          target = target.parentNode;
        }
      } else if(qx.core.Environment.get("event.mspointer")) {
        // Fix for IE10 and pointer-events:none
        var targetForIE = this.__evaluateTarget(domEvent);
        if(targetForIE) {
          target = targetForIE;
        }
      }

      return target;
    },


    /**
     * This method fixes "pointer-events:none" for Internet Explorer 10.
     * Checks which elements are placed to position x/y and traverses the array
     * till one element has no "pointer-events:none" inside its style attribute.
     * @param domEvent {Event} DOM event
     * @return {Element | null} Event target
     */
    __evaluateTarget : function(domEvent) {
      if(domEvent && domEvent.touches){
        var clientX = domEvent.touches[0].clientX;
        var clientY = domEvent.touches[0].clientY;
      }

      // Retrieve an array with elements on point X/Y.
      var hitTargets = document.msElementsFromPoint(clientX, clientY);
      if(hitTargets) {
        // Traverse this array for the elements which has no pointer-events:none inside.
        for(var i=0; i < hitTargets.length; i++) {
          var currentTarget = hitTargets[i];
          var pointerEvents = qx.bom.element.Style.get(currentTarget,"pointer-events",3);

          if(pointerEvents != "none") {
            return currentTarget;
          }
        }
      }

      return null;
    },


    /**
     * Fire a touch event with the given parameters
     *
     * @param domEvent {Event} DOM event
     * @param type {String ? null} type of the event
     * @param target {Element ? null} event target
     */
    _fireEvent : function(domEvent, type, target)
    {
      if (!target) {
        target = this._getTarget(domEvent);
      }

      var type = type || domEvent.type;

      if (target && target.nodeType && this.__emitter)
      {
        this.__emitter.emit(type, domEvent);
      }
    },


    /**
     * Checks if a gesture was made and fires the gesture event.
     *
     * @param domEvent {Event} DOM event
     * @param type {String ? null} type of the event
     * @param target {Element ? null} event target
     */
    __checkAndFireGesture : function(domEvent, type, target)
    {
      if (!target) {
        target = this._getTarget(domEvent);
      }
      var type = type || domEvent.type;

      if (type == "touchstart")
      {
        this.__gestureStart(domEvent, target);
      }
      else if (type == "touchmove") {
        this.__gestureChange(domEvent, target);
      }
      else if (type == "touchend")
      {
        this.__gestureEnd(domEvent, target);
      }
    },


    /**
     * Helper method for gesture start.
     *
     * @param domEvent {Event} DOM event
     * @param target {Element} event target
     */
    __gestureStart : function(domEvent, target)
    {
      var touch = domEvent.changedTouches[0];
      this.__onMove = true;
      this.__startPageX = touch.screenX;
      this.__startPageY = touch.screenY;
      this.__startTime = new Date().getTime();
      this.__isSingleTouchGesture = domEvent.changedTouches.length === 1;
      // start the long tap timer
      if (this.__isSingleTouchGesture) {
        this.__longTapTimer = window.setTimeout(
          this.__fireLongTap.bind(this, domEvent, target),
          qx.event.handler.TouchCore.LONGTAP_TIME
        );
      }
    },


    /**
     * Helper method for gesture change.
     *
     * @param domEvent {Event} DOM event
     * @param target {Element} event target
     */
    __gestureChange : function(domEvent, target)
    {
      // Abort a single touch gesture when another touch occurs.
      if (this.__isSingleTouchGesture && domEvent.changedTouches.length > 1) {
        this.__isSingleTouchGesture = false;
      }
      // abort long tap timer if the distance is too big
      if (!this._isBelowTapMaxDistance(domEvent.changedTouches[0])) {
        this.__stopLongTapTimer();
      }
    },


    /**
     * Helper method for gesture end.
     *
     * @param domEvent {Event} DOM event
     * @param target {Element} event target
     */
    __gestureEnd : function(domEvent, target)
    {
      this.__onMove = false;

      // delete the long tap
      this.__stopLongTapTimer();

      if (this.__isSingleTouchGesture)
      {
        var touch = domEvent.changedTouches[0];

        var deltaCoordinates = {
            x : touch.screenX - this.__startPageX,
            y : touch.screenY - this.__startPageY
        };

        var eventType;

        if (this.__originalTarget == target && this.__isTapGesture) {
          if (qx.event && qx.event.type && qx.event.type.Tap) {
            eventType = qx.event.type.Tap;
          }
          this._fireEvent(domEvent, "tap", target, eventType);
        }
        else
        {
          var swipe = this.__getSwipeGesture(domEvent, target, deltaCoordinates);
          if (swipe) {
            if (qx.event && qx.event.type && qx.event.type.Swipe) {
              eventType = qx.event.type.Swipe;
            }
            domEvent.swipe = swipe;
            this._fireEvent(domEvent, "swipe", target, eventType);
          }
        }
      }
    },


    /**
     * Returns the swipe gesture when the user performed a swipe.
     *
     * @param domEvent {Event} DOM event
     * @param target {Element} event target
     * @param deltaCoordinates {Map} delta x/y coordinates since the gesture started.
     * @return {Map} returns the swipe data when the user performed a swipe, null if the gesture was no swipe.
     */
    __getSwipeGesture : function(domEvent, target, deltaCoordinates)
    {
      var clazz = qx.event.handler.TouchCore;
      var duration = new Date().getTime() - this.__startTime;
      var axis = (Math.abs(deltaCoordinates.x) >= Math.abs(deltaCoordinates.y)) ? "x" : "y";
      var distance = deltaCoordinates[axis];
      var direction = clazz.SWIPE_DIRECTION[axis][distance < 0 ? 0 : 1]
      var velocity = (duration !== 0) ? distance/duration : 0;

      var swipe = null;
      if (Math.abs(velocity) >= clazz.SWIPE_MIN_VELOCITY
          && Math.abs(distance) >= clazz.SWIPE_MIN_DISTANCE)
      {
        swipe = {
            startTime : this.__startTime,
            duration : duration,
            axis : axis,
            direction : direction,
            distance : distance,
            velocity : velocity
        };
      }
      return swipe;
    },


    /**
     * Fires the long tap event.
     *
     * @param domEvent {Event} DOM event
     * @param target {Element} event target
     */
    __fireLongTap : function(domEvent, target) {
      this._fireEvent(domEvent, "longtap", target, qx.event.type.Tap);
      this.__longTapTimer = null;
      // prevent the tap event
      this.__isTapGesture = false;
    },


    /**
     * Stops the time for the long tap event.
     */
    __stopLongTapTimer : function() {
      if (this.__longTapTimer) {
        window.clearTimeout(this.__longTapTimer);
        this.__longTapTimer = null;
      }
    },


    /**
     * Dispose this object
     */
    dispose : function()
    {
      this._stopTouchObserver();
      this.__originalTarget = this.__target = this.__emitter = this.__beginScalingDistance = this.__beginRotation = null;
      this.__stopLongTapTimer();
    }
  }
});
