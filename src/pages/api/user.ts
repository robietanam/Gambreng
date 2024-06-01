import { request } from 'http';
import type { NextApiRequest, NextApiResponse } from 'next'
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod'
import formidable from "formidable";

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  
  const data = req.body
  const query = req.query

  switch (req.method){
    case "POST":  
      const id = uuidv4()

      const newUser = await prisma.user.upsert({
        where: {
          name: data.username
        }, 
        update: {
        },
        create: {
          
          name: data.username,
          id: id,
        }
      })
      res.status(200).json(newUser)
      break

    case "GET":
      console.log(query)
      const dataUser = await prisma.user.findUnique({ where : {
          id : query.userId,
        }, include: {
        File: {where : {fileName: {contains: (query.search == "null" || query.search == "undefined") ? undefined : query.search}  }} }
      },)
      
      res.status(200).json(dataUser)
      break
      
    default:
      res.status(200).json({ message: "Method tidak disupport" });
  }
  
}