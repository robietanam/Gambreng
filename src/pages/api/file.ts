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
      
      console.log(data)
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
      console.log(query)
      const file = await prisma.file.findUnique({
        where: {    
          id: query.fileId,
          user: { some: { id : query.userId}}
        }, include : {
          user: true
        }
      })
      
      console.log(file)
      res.status(200).json(file)
      break
    
    default:
      res.status(200).json({ message: "Method tidak disupport" });
  }
  
}