"use client";

import { FC, useEffect, useState, useRef } from "react";
import { useDraw } from "@/hooks/useDraw";
import { TwitterPicker } from "react-color";
import { IoTrashBin, IoPencil, IoText, IoDocumentText } from "react-icons/io5";
import { getCookie, setCookie } from "cookies-next";

import { useSearchParams } from "next/navigation";
import { io } from "socket.io-client";
import { drawLine } from "@/utils/drawLine";
import { Socket } from "socket.io";
import { Prisma } from "@prisma/client";
import _ from "lodash";
let socket: Socket;

interface pageProps {}

type DrawLineProps = {
  prevPoint: Point | null;
  currentPoint: Point;
  color: string;
};

type FilewithUser = Prisma.FileGetPayload<{
  include: {
    user: true;
  };
}>;
export default function Home() {
  const searchParams = useSearchParams();
  const coockieSessionId = getCookie("sessionId");
  const coockieUserId = getCookie("userId");
  const paramFileId = searchParams.get("fileId");

  console.log(coockieSessionId);

  const [color, setColor] = useState<string>("#000");
  const { canvasRef, onMouseDown, clear, onTouchStart } = useDraw(createLine);

  const [fileInfo, setFileInfo] = useState<FilewithUser>({
    id: paramFileId,
  });
  const [userId, setUserId] = useState(coockieUserId);

  useEffect(() => {
    if (coockieUserId == null || paramFileId == null)
      return console.log("Terjadi kesalahan");
    getFileInfo(coockieUserId, paramFileId);
  }, [coockieUserId, paramFileId]);

  useEffect(() => {
    if (fileInfo.fileName) {
      socketInitializer(fileInfo.id);
    }
  }, [canvasRef, fileInfo.fileName]);

  console.log(fileInfo);

  async function getFileInfo(userId: String, fileId: String) {
    const response = await fetch(
      "/api/file?userId=" + userId + "&fileId=" + fileId,
      {
        method: "GET",
      }
    );
    // Handle response if necessary
    const data: FilewithUser = await response.json();
    if (data) {
      setFileInfo(data);
    } else {
      console.log("Anda tidak memiliki izin");
    }
  }

  const socketInitializer = async (fileId: String) => {
    // socket = io("http://localhost:3001");
    await fetch("/api/socket?fileId=" + fileId);
    socket = io();

    // socket.on("connect", () => {
    //   socket.emit("user_id", userId);
    //   // socket.emit("fileInfo", fileInfo);
    //   setCookie("sessionId", socket.id);
    //   console.log("connected");
    // });

    const ctx = canvasRef.current?.getContext("2d");

    socket.emit("client-ready", { fileInfo });

    socket.on("get-canvas-state", () => {
      if (!canvasRef.current?.toDataURL()) return;
      console.log("sending canvas state");
      socket.emit("canvas-state", {
        fileInfo,
        data: canvasRef.current.toDataURL(),
      });
    });

    socket.on("user-state-from-server", (state) => {
      console.log("I received the state");

      console.log(state);
    });

    socket.on("canvas-state-from-server", (state: string) => {
      console.log("I received the state");
      const img = new Image();
      img.src = state;
      img.onload = () => {
        ctx?.drawImage(img, 0, 0);
      };
    });

    socket.on(
      "draw-line",
      ({ prevPoint, currentPoint, color }: DrawLineProps) => {
        if (!ctx) return console.log("no ctx here");
        drawLine({ prevPoint, currentPoint, ctx, color });
      }
    );

    //On mouse movement, using throttling, send mouse position via socket.io
    document
      .getElementsByTagName("BODY")[0]
      .addEventListener("mousemove", handleMouseMove);
    var sendMousePosition_throttled = _.throttle(sendMousePosition, 50);

    function handleMouseMove(event) {
      sendMousePosition_throttled(event);
    }

    socket.on("clear", clear);

    return () => {
      socket.removeAllListeners("draw-line");
      socket.removeAllListeners("get-canvas-state");
      socket.removeAllListeners("canvas-state-from-server");
      socket.removeAllListeners("clear");
      socket.disconnect();
    };
  };

  function moveCursorToPosition(data) {
    //Create a div, if it doesn't already exist for this
    if (!document.getElementById("mousePosition-" + data.id)) {
      var element = document.createElement("div");
      //Set ID, class and style (color based on hash of string)
      element.setAttribute("id", "mousePosition-" + data.id);
      element.setAttribute("class", "mousePosition");
      element.style.backgroundColor = "#" + intToRGB(hashCode(data.id));
      //Add to document
      document.getElementsByTagName("body")[0].appendChild(element);
    }

    //Move into position
    element = document.getElementById("mousePosition-" + data.id);
    element.style.left = data.x + "px";
    element.style.top = data.y + "px";
  }

  function sendMousePosition(event) {
    console.log("sendMousePosition");

    socket.emit("mousemove", {
      x: event.clientX,
      y: event.clientY,
      x_pct: ((event.layerX / event.view.screen.width) * 100).toFixed(3),
      y_pct: ((event.layerY / event.view.screen.height) * 100).toFixed(3),
    });
  }

  function createLine({ prevPoint, currentPoint, ctx }: Draw) {
    if (socket == null) return;
    socket.emit("draw-line", {
      fileInfo,
      data: { prevPoint, currentPoint, color },
    });
    drawLine({ prevPoint, currentPoint, ctx, color });
  }
  return (
    <div className="w-[1800px] h-[1800px]">
      <canvas
        ref={canvasRef}
        onMouseDown={onMouseDown}
        onTouchStart={onTouchStart}
        width={1800}
        height={1800}
        className=" bg-white absolute border border-black rounded-md"
      />

      <div className="sticky w-fit top-5 left-5 flex flex-col gap-2  z-10 ">
        <div className=" flex flex-row justify-start  gap-2 pb-2">
          <input
            type="text"
            className="w-52 p-1 border border-green-600 rounded-lg"
            placeholder="Save file as..."
            value={fileInfo.fileName}
          />
          <button
            type="button"
            className="text-green-600 border-green-800  hover:text-white hover:bg-green-400 w-fit h-fit p-2 rounded-md border "
            onClick={() => socket.emit("clear")}
          >
            <IoDocumentText />
          </button>
        </div>
        <TwitterPicker color={color} onChange={(e) => setColor(e.hex)} />
        <div className="flex flex-row gap-3">
          <button
            type="button"
            className="text-red-600 border-red-800  hover:text-white hover:bg-red-400 w-fit h-fit p-2 rounded-md border "
            onClick={() => socket.emit("clear")}
          >
            <IoTrashBin />
          </button>
          <button
            type="button"
            className="text-blue-600 border-blue-800  hover:text-white hover:bg-blue-400 w-fit h-fit p-2 rounded-md border "
          >
            <IoPencil />
          </button>
          <button
            type="button"
            className="text-gray-600 border-gray-800  hover:text-white hover:bg-gray-400 w-fit h-fit p-2 rounded-md border "
          >
            <IoText />
          </button>
        </div>
        <div className="rounded-lg bg-gray-400 py-1 px-5 w-fit"> Users </div>
        <div className="flex flex-row gap-3">
          {fileInfo.user?.map((user) => (
            <div
              key={user.id}
              className="avatar placeholder tooltip"
              data-tip={user.name}
            >
              <div className="bg-neutral text-neutral-content rounded-full w-12">
                <span>{user.name[0].toUpperCase()}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
