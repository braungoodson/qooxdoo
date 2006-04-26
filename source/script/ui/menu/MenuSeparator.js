/* ************************************************************************

   qooxdoo - the new era of web interface development

   Copyright:
     (C) 2004-2006 by Schlund + Partner AG, Germany
         All rights reserved

   License:
     LGPL 2.1: http://creativecommons.org/licenses/LGPL/2.1/

   Internet:
     * http://qooxdoo.oss.schlund.de

   Authors:
     * Sebastian Werner (wpbasti)
       <sebastian dot werner at 1und1 dot de>
     * Andreas Ecker (aecker)
       <andreas dot ecker at 1und1 dot de>

************************************************************************ */

/* ************************************************************************

#package(menu)
#use(qx.ui.basic.Terminator)

************************************************************************ */

qx.OO.defineClass("qx.ui.menu.MenuSeparator", qx.ui.layout.CanvasLayout,
function()
{
  qx.ui.layout.CanvasLayout.call(this);

  // Fix IE Styling Issues
  this.setStyleProperty("fontSize", "0");
  this.setStyleProperty("lineHeight", "0");

  // ************************************************************************
  //   LINE
  // ************************************************************************

  this._line = new qx.ui.basic.Terminator;
  this._line.setAnonymous(true);
  this._line.setAppearance("menu-separator-line");
  this.add(this._line);


  // ************************************************************************
  //   EVENTS
  // ************************************************************************

  // needed to stop the event, and keep the menu showing
  this.addEventListener(qx.Const.EVENT_TYPE_MOUSEDOWN, this._onmousedown);
});

qx.OO.changeProperty({ name : "appearance", type : qx.Const.TYPEOF_STRING, defaultValue : "menu-separator" });

qx.Proto.hasIcon = qx.util.Return.returnFalse;
qx.Proto.hasLabel = qx.util.Return.returnFalse;
qx.Proto.hasShortcut = qx.util.Return.returnFalse;
qx.Proto.hasMenu = qx.util.Return.returnFalse;

qx.Proto._onmousedown = function(e) {
  e.stopPropagation();
};

qx.Proto.dispose = function()
{
  if (this.getDisposed()) {
    return true;
  };

  if (this._line)
  {
    this._line.dispose();
    this._line = null;
  };

  return qx.ui.layout.CanvasLayout.prototype.dispose.call(this);
};
