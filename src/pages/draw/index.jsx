"use client";
import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import rough from "roughjs";
import getStroke from "perfect-freehand";
import { io } from "socket.io-client";
import { getCookie, setCookie } from "cookies-next";
import { throttle, isEmpty } from "lodash";

import { TwitterPicker } from "react-color";
import {
  IoTrashBin,
  IoPencil,
  IoText,
  IoDocumentText,
  IoAddCircle,
  IoAdd,
  IoHandLeft,
  IoBrush,
  IoArrowUndoCircle,
  IoArrowRedoCircle,
} from "react-icons/io5";
import { RiRectangleFill } from "react-icons/ri";

import { useSearchParams } from "next/navigation";

let socket;
let canvas;
let context;
let roughCanvas;

const generator = rough.generator();

// Hook
function useWindowSize() {
  // Initialize state with undefined width/height so server and client renders match
  // Learn more here: https://joshwcomeau.com/react/the-perils-of-rehydration/
  const [windowSize, setWindowSize] = useState({
    width: undefined,
    height: undefined,
  });

  useEffect(() => {
    // only execute all the code below in client side
    // Handler to call on window resize
    function handleResize() {
      // Set window width/height to state
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    }

    // Add event listener
    window.addEventListener("resize", handleResize);

    // Call handler right away so state gets updated with initial window size
    handleResize();

    // Remove event listener on cleanup
    return () => window.removeEventListener("resize", handleResize);
  }, []); // Empty array ensures that effect is only run on mount
  return windowSize;
}

const createElement = (id, x1, y1, x2, y2, type, color) => {
  console.log("color");
  console.log(color);
  switch (type) {
    case "delete":
    case "line":
    case "rectangle":
      const roughElement =
        type === "line"
          ? generator.line(x1, y1, x2, y2)
          : generator.rectangle(x1, y1, x2 - x1, y2 - y1, {
              fill: hex2rgb(color),
            });
      return { id, x1, y1, x2, y2, type, roughElement };
    case "pencil":
      return { id, type, points: [{ x: x1, y: y1 }], color };
    case "text":
      return { id, type, x1, y1, x2, y2, text: "", color };
    default:
      throw new Error(`Type not recognised: ${type}`);
  }
};

const hex2rgb = (hex) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);

  // return {r, g, b} rgb(10,150,10)
  return `rgb(${r}, ${g}, ${b})`;
};

const nearPoint = (x, y, x1, y1, name) => {
  return Math.abs(x - x1) < 5 && Math.abs(y - y1) < 5 ? name : null;
};

const onLine = (x1, y1, x2, y2, x, y, maxDistance = 1) => {
  const a = { x: x1, y: y1 };
  const b = { x: x2, y: y2 };
  const c = { x, y };
  const offset = distance(a, b) - (distance(a, c) + distance(b, c));
  return Math.abs(offset) < maxDistance ? "inside" : null;
};

const positionWithinElement = (x, y, element) => {
  const { type, x1, x2, y1, y2 } = element;
  switch (type) {
    case "delete":
    case "line":
      const on = onLine(x1, y1, x2, y2, x, y);
      const start = nearPoint(x, y, x1, y1, "start");
      const end = nearPoint(x, y, x2, y2, "end");
      return start || end || on;
    case "rectangle":
      const topLeft = nearPoint(x, y, x1, y1, "tl");
      const topRight = nearPoint(x, y, x2, y1, "tr");
      const bottomLeft = nearPoint(x, y, x1, y2, "bl");
      const bottomRight = nearPoint(x, y, x2, y2, "br");
      const inside = x >= x1 && x <= x2 && y >= y1 && y <= y2 ? "inside" : null;
      return topLeft || topRight || bottomLeft || bottomRight || inside;
    case "pencil":
      const betweenAnyPoint = element.points.some((point, index) => {
        const nextPoint = element.points[index + 1];
        if (!nextPoint) return false;
        return (
          onLine(point.x, point.y, nextPoint.x, nextPoint.y, x, y, 5) != null
        );
      });
      return betweenAnyPoint ? "inside" : null;
    case "text":
      return x >= x1 && x <= x2 && y >= y1 && y <= y2 ? "inside" : null;
    default:
      throw new Error(`Type not recognised: ${type}`);
  }
};

const distance = (a, b) =>
  Math.sqrt(Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2));

const getElementAtPosition = (x, y, elements) => {
  return elements
    .map((element) => ({
      ...element,
      position: positionWithinElement(x, y, element),
    }))
    .find((element) => element.position !== null);
};

const adjustElementCoordinates = (element) => {
  const { type, x1, y1, x2, y2 } = element;
  if (type === "rectangle") {
    const minX = Math.min(x1, x2);
    const maxX = Math.max(x1, x2);
    const minY = Math.min(y1, y2);
    const maxY = Math.max(y1, y2);
    return { x1: minX, y1: minY, x2: maxX, y2: maxY };
  } else {
    if (x1 < x2 || (x1 === x2 && y1 < y2)) {
      return { x1, y1, x2, y2 };
    } else {
      return { x1: x2, y1: y2, x2: x1, y2: y1 };
    }
  }
};

const cursorForPosition = (position) => {
  switch (position) {
    case "tl":
    case "br":
    case "start":
    case "end":
      return "nwse-resize";
    case "tr":
    case "bl":
      return "nesw-resize";
    default:
      return "move";
  }
};

const resizedCoordinates = (clientX, clientY, position, coordinates) => {
  const { x1, y1, x2, y2 } = coordinates;
  switch (position) {
    case "tl":
    case "start":
      return { x1: clientX, y1: clientY, x2, y2 };
    case "tr":
      return { x1, y1: clientY, x2: clientX, y2 };
    case "bl":
      return { x1: clientX, y1, x2, y2: clientY };
    case "br":
    case "end":
      return { x1, y1, x2: clientX, y2: clientY };
    default:
      return null; //should not really get here...
  }
};

const useHistory = (initialState, setAction) => {
  const [index, setIndex] = useState(0);
  const [history, setHistory] = useState([initialState]);

  const setState = (action, overwrite = false) => {
    const newState =
      typeof action === "function" ? action(history[index]) : action;
    if (overwrite) {
      const historyCopy = [...history];
      historyCopy[index] = newState;
      setHistory(historyCopy);
    } else {
      const updatedState = [...history].slice(0, index + 1);
      setHistory([...updatedState, newState]);
      setIndex((prevState) => prevState + 1);
    }
  };

  const undo = () => {
    setAction("undo");
    return index > 0 && setIndex((prevState) => prevState - 1);
  };
  const redo = () => {
    setAction("redo");
    return index < history.length - 1 && setIndex((prevState) => prevState + 1);
  };

  return [history[index], setState, undo, redo];
};

const getSvgPathFromStroke = (stroke) => {
  if (!stroke.length) return "";

  const d = stroke.reduce(
    (acc, [x0, y0], i, arr) => {
      const [x1, y1] = arr[(i + 1) % arr.length];
      acc.push(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
      return acc;
    },
    ["M", ...stroke[0], "Q"]
  );

  d.push("Z");
  return d.join(" ");
};

const drawElement = (roughCanvas, context, element) => {
  context.fillStyle = element.color;
  switch (element.type) {
    case "line":
    case "rectangle":
      roughCanvas.draw(element.roughElement);
      break;
    case "pencil":
      const stroke = getSvgPathFromStroke(getStroke(element.points));
      context.fill(new Path2D(stroke));
      break;
    case "text":
      context.textBaseline = "top";
      context.font = "24px sans-serif";
      context.fillText(element.text, element.x1, element.y1);
      break;
    default:
      throw new Error(`Type not recognised: ${element.type}`);
  }
};

const adjustmentRequired = (type) => ["line", "rectangle"].includes(type);

const usePressedKeys = () => {
  const [pressedKeys, setPressedKeys] = useState(new Set());

  useEffect(() => {
    const handleKeyDown = (event) => {
      setPressedKeys((prevKeys) => new Set(prevKeys).add(event.key));
    };

    const handleKeyUp = (event) => {
      setPressedKeys((prevKeys) => {
        const updatedKeys = new Set(prevKeys);
        updatedKeys.delete(event.key);
        return updatedKeys;
      });
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  return pressedKeys;
};

const App = () => {
  const searchParams = useSearchParams();
  const coockieUserId = getCookie("userId");

  const coockieUsername = getCookie("username");
  const paramFileId = searchParams.get("fileId");

  const size = useWindowSize();

  const [fileInfo, setFileInfo] = useState({});
  const [userId, setUserId] = useState(coockieUserId);
  const [userIdOnline, setUserIdOnline] = useState([]);

  const [color, setColor] = useState("#000");
  const [action, setAction] = useState("none");
  const [elements, setElements, undo, redo] = useHistory([], setAction);
  const [tool, setTool] = useState("rectangle");
  const [selectedElement, setSelectedElement] = useState(null);
  const [panOffset, setPanOffset] = React.useState({ x: 0, y: 0 });
  const [startPanMousePosition, setStartPanMousePosition] = React.useState({
    x: 0,
    y: 0,
  });
  const textAreaRef = useRef();
  const pressedKeys = usePressedKeys();

  async function getFileInfo(userId, fileId) {
    const response = await fetch(
      "/api/file?userId=" + userId + "&fileId=" + fileId,
      {
        method: "GET",
      }
    );
    // Handle response if necessary
    const data = await response.json();
    if (data) {
      setFileInfo(data);
    } else {
      console.log("Anda tidak memiliki izin");
    }
  }

  useEffect(() => {
    console.log("HAI");
    console.log(fileInfo);
    if (
      fileInfo.data != null &&
      fileInfo.data != {} &&
      fileInfo.data != undefined &&
      !isEmpty(fileInfo.data)
    ) {
      let jsonData = JSON.parse(fileInfo.data);
      setElements(jsonData);
    }
  }, [fileInfo.data]);

  useEffect(() => {
    console.log("=====================");
    console.log(coockieUserId);
    console.log(paramFileId);
    if (coockieUserId == null || paramFileId == null)
      return console.log("Terjadi kesalahan");
    getFileInfo(coockieUserId, paramFileId);
  }, [coockieUserId, paramFileId]);

  async function saveFile() {
    const response = await fetch("/api/save", {
      method: "POST",
      body: JSON.stringify({
        fileId: fileInfo.id,
        dataFile: JSON.stringify(elements),
      }),
    });

    if (response.status == 200) {
      document.getElementById("pesan").showModal();
    }
    console.log(response);
  }

  async function onAddUser(event) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);

    const response = await fetch("/api/file", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        newUserId: formData.get("id_user"),
        fileId: fileInfo.id,
        userId: userId,
      }),
    });

    if (response.status == 200) {
      getFileInfo(coockieUserId, paramFileId);
    }
  }

  useEffect(() => {
    if (fileInfo.fileName) {
      fetch("/api/socket");
      socket = io();

      console.log("RECONNECT!!!!!!!!!!!!");

      socket.emit("req-canvas-state", { fileId: fileInfo.id });

      socket.on("user-state-from-server", (state) => {
        moveCursorToPosition(state);
      });

      document
        .getElementById("draw-canvas")
        .addEventListener("mousemove", handleMouseMove);

      var sendMousePosition_throttled = throttle(sendMousePosition, 50);

      function handleMouseMove(event) {
        sendMousePosition_throttled(event);
      }

      function sendMousePosition(event) {
        socket.emit("mousemove", {
          fileId: fileInfo.id,
          data: {
            userId: userId,
            name: coockieUsername,
            x: event.clientX,
            y: event.clientY,
            x_pct: ((event.layerX / event.view.screen.width) * 100).toFixed(3),
            y_pct: ((event.layerY / event.view.screen.height) * 100).toFixed(3),
          },
        });
      }

      return () => {
        document
          .getElementById("draw-canvas")
          .removeEventListener("mousemove", handleMouseMove);
        socket.removeAllListeners("get-canvas-state");
        socket.removeAllListeners("user-state-from-server");
        socket.removeAllListeners("canvas-state-from-server");
        socket.removeAllListeners("canvas-state-from-server-update");
        socket.disconnect();
      };
    }
  }, [fileInfo.fileName]);

  function moveCursorToPosition(data) {
    //Create a div, if it doesn't already exist for this
    if (!document.getElementById("mousePosition-" + data.userId)) {
      var element = document.createElement("div");
      //Set ID, class and style (color based on hash of string)
      element.setAttribute("id", "mousePosition-" + data.userId);
      element.setAttribute("class", "mousePosition");
      element.style.backgroundColor = "#" + intToRGB(hashCode(data.userId));
      //Add to document

      document.getElementById("draw-canvas").appendChild(element);
    }

    //Move into position
    element = document.getElementById("mousePosition-" + data.userId);

    if (data.userId != userId) {
      element.innerHTML = `<p> ${data.name}</p>`;
    }
    element.style.backgroundColor = data.color;
    element.style.left = data.x + "px";
    element.style.top = data.y + "px";
  }

  //Helper functions for setting a color from a string
  function hashCode(str) {
    var hash = 0;
    for (var i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return hash;
  }

  function intToRGB(i) {
    var c = (i & 0x00ffffff).toString(16).toUpperCase();
    return "00000".substring(0, 6 - c.length) + c;
  }

  useEffect(() => {
    socket?.on("get-canvas-state", () => {
      if (elements.length !== 0) {
        console.log("Minta state canvas");
        socket.emit("canvas-state", {
          fileId: fileInfo.id,
          data: elements,
        });
      }
    });
  }, [elements, fileInfo.id]);

  useEffect(() => {
    console.log("SEND TO SERVER" + action);
    console.log(elements);
    socket?.emit("canvas-state-update", {
      data: elements,
      fileId: fileInfo.id,
    });
  }, [action]);

  useEffect(() => {
    console.log("KIRIM");

    socket?.on("canvas-state-from-server", (state) => {
      console.log("State dari server");
      setElements(state);
    });

    socket?.on("canvas-state-from-server-update", (state) => {
      console.log("State dari server update");
      setElements(state);
    });

    return () => {
      socket?.removeAllListeners("get-canvas-state");
      socket?.removeAllListeners("canvas-state-from-server");
      socket?.removeAllListeners("canvas-state-from-server-update");
    };
  }, [setElements]);

  useEffect(() => {
    canvas = document.getElementById("canvas");
    context = canvas.getContext("2d");
    roughCanvas = rough.canvas(canvas);

    console.log({ element: elements });
    console.log({ selected: selectedElement });
    console.log("ACTION : " + action);

    context.clearRect(0, 0, canvas.width, canvas.height);

    context.save();
    context.translate(panOffset.x, panOffset.y);

    elements.forEach((element) => {
      if (action === "writing" && selectedElement.id === element.id) return;
      drawElement(roughCanvas, context, element);
    });
    context.restore();
  }, [elements, action, selectedElement, panOffset]);

  useEffect(() => {
    const undoRedoFunction = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "z") {
        if (event.shiftKey) {
          redo();
        } else {
          undo();
        }
      }
    };

    document.addEventListener("keydown", undoRedoFunction);
    return () => {
      document.removeEventListener("keydown", undoRedoFunction);
    };
  }, [undo, redo]);

  useEffect(() => {
    const panFunction = (event) => {
      setPanOffset((prevState) => ({
        x: prevState.x - event.deltaX,
        y: prevState.y - event.deltaY,
      }));
    };

    document.addEventListener("wheel", panFunction);
    return () => {
      document.removeEventListener("wheel", panFunction);
    };
  }, []);

  useEffect(() => {
    const textArea = textAreaRef.current;
    if (action === "writing") {
      setTimeout(() => {
        textArea.focus();
        textArea.value = selectedElement.text;
      }, 0);
    }
  }, [action, selectedElement]);

  const updateElement = (id, x1, y1, x2, y2, type, options) => {
    const elementsCopy = [...elements];

    switch (type) {
      case "line":
      case "rectangle":
        elementsCopy[id] = createElement(id, x1, y1, x2, y2, type, color);
        break;
      case "pencil":
        elementsCopy[id].points = [
          ...elementsCopy[id].points,
          { x: x2, y: y2 },
        ];
        break;
      case "text":
        const textWidth = document
          .getElementById("canvas")
          .getContext("2d")
          .measureText(options.text).width;
        const textHeight = 24;
        elementsCopy[id] = {
          ...createElement(
            id,
            x1,
            y1,
            x1 + textWidth,
            y1 + textHeight,
            type,
            color
          ),
          text: options.text,
        };
        break;
      default:
        throw new Error(`Type not recognised: ${type}`);
    }

    setElements(elementsCopy, true);
  };

  const getMouseCoordinates = (event) => {
    const clientX = event.clientX - panOffset.x;
    const clientY = event.clientY - panOffset.y;
    return { clientX, clientY };
  };

  const handleMouseDown = (event) => {
    if (action === "writing") return;

    const { clientX, clientY } = getMouseCoordinates(event);

    if (event.button === 1 || pressedKeys.has(" ")) {
      setAction("panning");
      setStartPanMousePosition({ x: clientX, y: clientY });
      return;
    }

    if (tool === "selection") {
      const element = getElementAtPosition(clientX, clientY, elements);
      if (element) {
        if (element.type === "pencil") {
          const xOffsets = element.points.map((point) => clientX - point.x);
          const yOffsets = element.points.map((point) => clientY - point.y);
          setSelectedElement({ ...element, xOffsets, yOffsets });
        } else {
          const offsetX = clientX - element.x1;
          const offsetY = clientY - element.y1;
          setSelectedElement({ ...element, offsetX, offsetY });
        }
        setElements((prevState) => prevState);

        if (element.position === "inside") {
          setAction("moving");
        } else {
          setAction("resizing");
        }
      }
    } else if (tool === "delete") {
      setAction("delete");
      const element = getElementAtPosition(clientX, clientY, elements);
      if (element) {
        setElements((prevState) =>
          prevState.filter((item) => item.id !== element.id)
        );
      }
    } else {
      const id = elements.length;
      const element = createElement(
        id,
        clientX,
        clientY,
        clientX,
        clientY,
        tool,
        color
      );
      setElements((prevState) => [...prevState, element]);
      setSelectedElement(element);

      setAction(tool === "text" ? "writing" : "drawing");
    }
  };

  const handleMouseMove = (event) => {
    const { clientX, clientY } = getMouseCoordinates(event);

    if (action === "panning") {
      const deltaX = clientX - startPanMousePosition.x;
      const deltaY = clientY - startPanMousePosition.y;
      setPanOffset({
        x: panOffset.x + deltaX,
        y: panOffset.y + deltaY,
      });
      return;
    }

    if (tool === "selection") {
      const element = getElementAtPosition(clientX, clientY, elements);
      event.target.style.cursor = element
        ? cursorForPosition(element.position)
        : "default";
    }

    if (tool === "delete") {
      const element = getElementAtPosition(clientX, clientY, elements);
      event.target.style.cursor = element
        ? cursorForPosition(element.position)
        : "default";
    }

    if (action === "drawing") {
      const index = elements.length - 1;
      const { x1, y1 } = elements[index];
      updateElement(index, x1, y1, clientX, clientY, tool);
    } else if (action === "moving") {
      if (selectedElement.type === "pencil") {
        const newPoints = selectedElement.points.map((_, index) => ({
          x: clientX - selectedElement.xOffsets[index],
          y: clientY - selectedElement.yOffsets[index],
        }));
        const elementsCopy = [...elements];
        elementsCopy[selectedElement.id] = {
          ...elementsCopy[selectedElement.id],
          points: newPoints,
        };
        setElements(elementsCopy, true);
      } else {
        const { id, x1, x2, y1, y2, type, offsetX, offsetY } = selectedElement;
        const width = x2 - x1;
        const height = y2 - y1;
        const newX1 = clientX - offsetX;
        const newY1 = clientY - offsetY;
        const options = type === "text" ? { text: selectedElement.text } : {};
        updateElement(
          id,
          newX1,
          newY1,
          newX1 + width,
          newY1 + height,
          type,
          options
        );
      }
    } else if (action === "resizing") {
      const { id, type, position, ...coordinates } = selectedElement;
      const { x1, y1, x2, y2 } = resizedCoordinates(
        clientX,
        clientY,
        position,
        coordinates
      );
      updateElement(id, x1, y1, x2, y2, type);
    }
  };

  const handleMouseUp = (event) => {
    const { clientX, clientY } = getMouseCoordinates(event);
    if (selectedElement) {
      if (
        selectedElement.type === "text" &&
        clientX - selectedElement.offsetX === selectedElement.x1 &&
        clientY - selectedElement.offsetY === selectedElement.y1
      ) {
        setAction("writing");
        return;
      }

      const index = selectedElement.id;
      const { id, type } = elements[index];
      if (
        (action === "drawing" || action === "resizing") &&
        adjustmentRequired(type)
      ) {
        const { x1, y1, x2, y2 } = adjustElementCoordinates(elements[index]);
        updateElement(id, x1, y1, x2, y2, type);
      }
    }

    if (action === "writing") return;

    setAction("none");
    setSelectedElement(null);
  };

  const handleBlur = (event) => {
    const { id, x1, y1, type } = selectedElement;
    setAction("none");
    setSelectedElement(null);
    updateElement(id, x1, y1, null, null, type, { text: event.target.value });
  };

  return (
    <div id="draw-canvas" className="max-w-screen max-h-screen">
      <div style={{ position: "fixed", zIndex: 2 }}>
        <dialog id="pesan" className="modal">
          <form method="dialog" className="modal-backdrop">
            <button>close</button>
          </form>
          <div className="modal-box">
            <form method="dialog">
              <button className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2">
                ✕
              </button>
            </form>
            <h3 className="font-bold text-lg">Data Berhasil Disimpan</h3>
          </div>
        </dialog>

        <dialog id="add_user_modal" className="modal">
          <form method="dialog" className="modal-backdrop">
            <button>close</button>
          </form>
          <div className="modal-box">
            <form method="dialog">
              <button className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2">
                ✕
              </button>
            </form>
            <h3 className="font-bold text-lg">Hello!</h3>
            <p className="py-4">Masukkan Id user</p>

            <form onSubmit={onAddUser}>
              <input
                type="text"
                placeholder="ID User"
                name="id_user"
                className="input input-bordered input-sm w-full"
              />
              <div className="modal-action">
                {/* if there is a button in form, it will close the modal */}
                <button className="btn" type="submit">
                  Simpan
                </button>
              </div>
            </form>
          </div>
        </dialog>

        <div className="sticky w-fit top-5 left-5 flex flex-col gap-2 z-10 bg-gray-200 rounded-md p-4">
          <div className=" flex flex-row justify-start  gap-2 pb-2">
            <input
              type="text"
              className="w-52 p-1 border border-green-600 rounded-lg"
              placeholder="Save file as..."
              value={fileInfo.fileName}
            />
            <button type="button" onClick={saveFile}>
              <IoDocumentText className="text-green-600 border-green-800  hover:text-white hover:bg-green-400 w-fit h-fit p-2 rounded-md border " />
            </button>
          </div>
          <TwitterPicker
            color={color}
            onChange={(e) => {
              setColor(e.hex);
            }}
          />
          <div className="flex flex-row gap-3  w-fit">
            <button
              type="button"
              className={
                tool === "selection"
                  ? "text-white bg-yellow-300 w-fit h-fit p-2 rounded-md border "
                  : "text-yellow-500 border-yellow-800  hover:text-white hover:bg-yellow-400 w-fit h-fit p-2 rounded-md border "
              }
              onClick={() => setTool("selection")}
            >
              <IoHandLeft />
            </button>
            <button
              type="button"
              className={
                tool === "delete"
                  ? "text-white bg-red-400 w-fit h-fit p-2 rounded-md border "
                  : "text-red-600 border-red-800  hover:text-white hover:bg-red-400 w-fit h-fit p-2 rounded-md border "
              }
              onClick={() => setTool("delete")}
            >
              <IoTrashBin />
            </button>
            <button
              type="button"
              className={
                tool === "line"
                  ? "text-white bg-blue-400 w-fit h-fit p-2 rounded-md border "
                  : "text-blue-600 border-blue-800  hover:text-white hover:bg-blue-400 w-fit h-fit p-2 rounded-md border  "
              }
              onClick={() => setTool("line")}
            >
              <IoPencil />
            </button>
            <button
              type="button"
              className={
                tool === "pencil"
                  ? "text-white bg-green-400 w-fit h-fit p-2 rounded-md border "
                  : "text-green-600 border-green-800  hover:text-white hover:bg-green-400 w-fit h-fit p-2 rounded-md border  "
              }
              onClick={() => setTool("pencil")}
            >
              <IoBrush />
            </button>
            <button
              type="button"
              className={
                tool === "text"
                  ? "text-gray bg-gray-400 w-fit h-fit p-2 rounded-md border "
                  : "text-gray-600 border-gray-800  hover:text-white hover:bg-gray-400 w-fit h-fit p-2 rounded-md border "
              }
              onClick={() => setTool("text")}
            >
              <IoText />
            </button>
            <button
              type="button"
              className={
                tool === "rectangle"
                  ? "text-white bg-purple-400 w-fit h-fit p-2 rounded-md border "
                  : "text-purple-600 border-purple-800  hover:text-white hover:bg-purple-400 w-fit h-fit p-2 rounded-md border  "
              }
              onClick={() => setTool("rectangle")}
            >
              <RiRectangleFill />
            </button>
          </div>
          <div className="flex flex-row gap-2  w-fit">
            <div className="rounded-lg bg-gray-400 py-1 px-5 w-fit">
              {" "}
              Users{" "}
            </div>
            <button
              type="button"
              className="text-yellow-600 border-yellow-800  hover:text-white hover:bg-yellow-400 w-fit h-fit p-2 rounded-md border "
              onClick={() =>
                document.getElementById("add_user_modal").showModal()
              }
            >
              <IoAdd />
            </button>
          </div>
          <div className="flex flex-row gap-3  w-fit">
            {fileInfo.user?.map((user) => (
              <div
                key={user.id}
                className="avatar placeholder tooltip"
                data-tip={user.name}
              >
                <div
                  id={`avatar-${user.id}`}
                  className="bg-neutral text-neutral-content rounded-full w-12"
                >
                  <span>{user.name[0].toUpperCase()}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-row gap-2">
            <button onClick={undo}>
              <IoArrowUndoCircle className="w-10 h-10" />
            </button>
            <button onClick={redo}>
              <IoArrowRedoCircle className="w-10 h-10" />
            </button>
          </div>
        </div>
      </div>

      {action === "writing" ? (
        <textarea
          ref={textAreaRef}
          onBlur={handleBlur}
          style={{
            position: "fixed",
            top: selectedElement.y1 - 2 + panOffset.y,
            left: selectedElement.x1 + panOffset.x,
            font: "24px sans-serif",
            margin: 0,
            padding: 0,
            border: 0,
            outline: 0,
            resize: "auto",
            overflow: "hidden",
            whiteSpace: "pre",
            background: "transparent",
            zIndex: 2,
          }}
        />
      ) : null}
      <canvas
        id="canvas"
        width={size.width}
        height={size.height}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        className="absolute z-1"
      >
        Canvas
      </canvas>
    </div>
  );
};

export default App;
