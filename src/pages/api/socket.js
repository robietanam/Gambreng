// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import { Server } from "socket.io"

export default function handler(
  req,
  res,
) {

  if (res.socket.server.io) {
    
    console.log('Socket is already running')
  } else {
    console.log('Socket is initializing')
    let io = new Server(res.socket.server)

    res.socket.server.io = io

    io.on('connection', (socket) => {
        
    socket.on('req-canvas-state', (state) => {
      // // console.log(state)
      //  fileId : fileInfo.id 
      // socket.join(state.fileInfo.id)
      // socket.to(state.fileInfo.id).emit('get-canvas-state')
      
      socket.join(state.fileId)
      socket.broadcast.to(state.fileId).emit('get-canvas-state')
    })

    socket.on('canvas-state', (state) => {
      // console.log(`received canvas state ${state}`)
      // socket.to(state.fileInfo.id).emit('canvas-state-from-server', state.data)
      socket.broadcast.to(state.fileId).emit('canvas-state-from-server', state.data)
    })

    socket.on('canvas-state-update', (state) => {
      // console.log(`received canvas state ${state}`)
      // socket.to(state.fileInfo.id).emit('canvas-state-from-server', state.data)
      socket.broadcast.to(state.fileId).emit('canvas-state-from-server-update', state.data)
    })

    socket.on('mousemove', (state) => {

      // socket.to(state.fileId).emit('user-state-from-server', state.data);
      socket.to(state.fileId).emit('user-state-from-server', state.data);
      // console.log(state)
    })

    // socket.on('user-state',  (state) => {
    //   // console.log(`received canvas state ${state}`)
    //   socket.to(state.fileInfo.id).emit('user-state-from-server', state.data)
    // })

    })
  }
  
  console.log("hit")
  console.log(req.query)
  
  console.log(res.socket.server.io.sockets.adapter.rooms)
  console.log(res.socket.server.io.sockets.adapter.sids)

  res.end()
}
