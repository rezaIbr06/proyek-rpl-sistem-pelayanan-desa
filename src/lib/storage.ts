import fs from 'fs'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'

// In a real production app, this would use AWS S3, Google Cloud Storage, or MinIO.
// For development, we store it in a private local directory outside of 'public'

const UPLOAD_DIR = path.join(process.cwd(), '.storage')

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true })
}

export async function uploadFile(file: File): Promise<string> {
  const bytes = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)

  // Generate unique filename
  const extension = path.extname(file.name) || (file.type === 'application/pdf' ? '.pdf' : '.jpg')
  const fileName = `${uuidv4()}${extension}`
  
  const filePath = path.join(UPLOAD_DIR, fileName)
  
  // Write file to local disk
  fs.writeFileSync(filePath, buffer)
  
  // Return the private API URL
  return `/api/files?path=${fileName}`
}

export async function deleteFile(fileUrl: string): Promise<boolean> {
  try {
    const fileName = path.basename(fileUrl)
    const filePath = path.join(UPLOAD_DIR, fileName)
    
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath)
      return true
    }
    return false
  } catch (error) {
    console.error('Error deleting file:', error)
    return false
  }
}
