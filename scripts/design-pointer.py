"""One trusted pointer motion in an isolated Xvfb display; no UI modification."""
import ctypes
import json
import os
import sys

x11 = ctypes.CDLL("libX11.so.6")
xtst = ctypes.CDLL("libXtst.so.6")
display_type = ctypes.c_void_p
window_type = ctypes.c_ulong
x11.XOpenDisplay.argtypes = [ctypes.c_char_p]
x11.XOpenDisplay.restype = display_type
x11.XDefaultRootWindow.argtypes = [display_type]
x11.XDefaultRootWindow.restype = window_type
x11.XQueryPointer.argtypes = [display_type, window_type, ctypes.POINTER(window_type), ctypes.POINTER(window_type), *([ctypes.POINTER(ctypes.c_int)] * 4), ctypes.POINTER(ctypes.c_uint)]
x11.XGetGeometry.argtypes = [display_type, window_type, ctypes.POINTER(window_type), ctypes.POINTER(ctypes.c_int), ctypes.POINTER(ctypes.c_int), *([ctypes.POINTER(ctypes.c_uint)] * 4)]
x11.XTranslateCoordinates.argtypes = [display_type, window_type, window_type, ctypes.c_int, ctypes.c_int, ctypes.POINTER(ctypes.c_int), ctypes.POINTER(ctypes.c_int), ctypes.POINTER(window_type)]
x11.XFetchName.argtypes = [display_type, window_type, ctypes.POINTER(ctypes.c_void_p)]
x11.XFree.argtypes = [ctypes.c_void_p]
x11.XSync.argtypes = [display_type, ctypes.c_int]
x11.XCloseDisplay.argtypes = [display_type]
xtst.XTestQueryExtension.argtypes = [display_type, *([ctypes.POINTER(ctypes.c_int)] * 4)]
xtst.XTestFakeMotionEvent.argtypes = [display_type, ctypes.c_int, ctypes.c_int, ctypes.c_int, ctypes.c_ulong]
display = x11.XOpenDisplay(None)
if not display:
    raise RuntimeError("No X display available")
try:
    root = x11.XDefaultRootWindow(display)
    extension = [ctypes.c_int() for _ in range(4)]
    if not xtst.XTestQueryExtension(display, *(ctypes.byref(value) for value in extension)):
        raise RuntimeError("XTEST extension is unavailable")

    def pointer_path():
        path = []
        current = root
        for _ in range(12):
            root_return, child = window_type(), window_type()
            root_x, root_y, local_x, local_y = (ctypes.c_int() for _ in range(4))
            mask = ctypes.c_uint()
            if not x11.XQueryPointer(display, current, ctypes.byref(root_return), ctypes.byref(child), ctypes.byref(root_x), ctypes.byref(root_y), ctypes.byref(local_x), ctypes.byref(local_y), ctypes.byref(mask)):
                break
            origin_x, origin_y, ignored = ctypes.c_int(), ctypes.c_int(), window_type()
            x11.XTranslateCoordinates(display, current, root, 0, 0, ctypes.byref(origin_x), ctypes.byref(origin_y), ctypes.byref(ignored))
            x, y = ctypes.c_int(), ctypes.c_int()
            width, height, border, depth = (ctypes.c_uint() for _ in range(4))
            x11.XGetGeometry(display, current, ctypes.byref(ignored), ctypes.byref(x), ctypes.byref(y), ctypes.byref(width), ctypes.byref(height), ctypes.byref(border), ctypes.byref(depth))
            name_pointer = ctypes.c_void_p()
            name = None
            if x11.XFetchName(display, current, ctypes.byref(name_pointer)) and name_pointer.value:
                name = ctypes.string_at(name_pointer.value).decode("utf-8", "replace")
                x11.XFree(name_pointer)
            path.append({"window": current, "name": name, "origin": [origin_x.value, origin_y.value], "size": [width.value, height.value], "rootPointer": [root_x.value, root_y.value], "localPointer": [local_x.value, local_y.value], "child": child.value})
            if not child.value or child.value == current:
                break
            current = child.value
        return path

    before = pointer_path()
    point = [int(value) for value in sys.argv[1:]]
    if len(point) != 2:
        raise ValueError("Expected one absolute integer X/Y pointer position")
    if not xtst.XTestFakeMotionEvent(display, -1, *point, 0):
        raise RuntimeError("XTEST rejected pointer motion")
    x11.XSync(display, 0)
    after = pointer_path()
    if not after or after[0]["rootPointer"] != point:
        raise RuntimeError("The X server pointer did not reach the requested location")
    print(json.dumps({"display": os.environ.get("DISPLAY"), "xtestVersion": [extension[2].value, extension[3].value], "point": point, "before": before, "after": after}))
finally:
    x11.XCloseDisplay(display)
