import type { NextApiRequest, NextApiResponse } from 'next'
import { v4 as uuidv4 } from 'uuid';

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  
  const data = req.body
  const query = req.query
  switch(req.method){
    case "POST":  
      const id = uuidv4()
      
      const newFile = await prisma.file.create({
        data: {
          fileName: data.fileName,
          id: id,
          data: {},
          user: {
            connect: {
              id: data.userId,
              name: data.userName
            }
          }
        },
      })
      res.status(200).json(newFile)
      break

    case "GET":  
      const file = await prisma.file.findUnique({
        where: {    
          id: query.fileId,
          user: { some: { id : query.userId}}
        }, include : {
          user: true
        }
      })
      
      res.status(200).json(file)
      break
    
    case "PUT":
      const fileUpdate = await prisma.file.update({
        where: {    
          id: data.fileId,
          user: { some: { id : data.userId}}
        },
        data : {
          user : {
            connect: {id : data.newUserId}
          }
        }
      })
      
      res.status(200).json(fileUpdate)
      break
    
    default:
      res.status(200).json({ message: "Method tidak disupport" });
  }
  
}