// Next.js API route support: https://nextjs.org/docs/api-routes/introduction

import type { NextApiRequest, NextApiResponse } from "next";
import { Server } from "socket.io"
import { Socket } from "socket.io-client";

type Data = {
  name: string;
};
  
type Point = { x: number; y: number }

type DrawLine = {
  prevPoint: Point | null
  currentPoint: Point
  color: string
}

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse<Data>,
) {

  if (res.socket.server.io) {
    
    console.log('Socket is already running')
  } else {
    console.log('Socket is initializing')
    let io = new Server(res.socket.server)

    res.socket.server.io = io

    io.on('connection', (socket) => {
        
    socket.on('client-ready', (state) => {
      // console.log(state)
      socket.join(state.fileInfo.id)
      socket.to(state.fileInfo.id).emit('get-canvas-state')
    })

    socket.on('canvas-state', (state) => {
      // console.log(`received canvas state ${state}`)
      socket.to(state.fileInfo.id).emit('canvas-state-from-server', state.data)
    })

    socket.on('mousemove', (state) => {

      io.to(state.fileId).emit('user-state-from-server', state.data);
      // console.log(state)
    })

    socket.on('user-state',  (state) => {
      // console.log(`received canvas state ${state}`)
      socket.to(state.fileInfo.id).emit('user-state-from-server', state.data)
    })

    socket.on('draw-line', (state) => {
      
      console.log(`received canvas line ${state.data.prevPoint?.x} ${state.data.currentPoint.x} ${state.data.color}`)
      socket.to(state.fileInfo.id).emit('draw-line', state.data)
    })

    socket.on('clear', (state) => io.to(state.fileInfo.id).emit('clear'))


    })
  }
  
  console.log("hit")
  console.log(req.query)
  
  console.log(res.socket.server.io.sockets.adapter.rooms)
  console.log(res.socket.server.io.sockets.adapter.sids)

  res.end()
}
