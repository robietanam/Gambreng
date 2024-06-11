
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export default async function handler(
  req,
  res
) {
  
  const data = JSON.parse(req.body)
  const query = req.query
  switch(req.method){
    case "POST":  
    //   const id = uuidv4()
      
      const newFile = await prisma.file.update({
        where: {
            id: data.fileId
        },
        data: {
          data:  data.dataFile,
        },
      })
      res.status(200).json(newFile)
      break
    

    default:
      res.status(200).json({ message: "Method tidak disupport" });
  }
  
}