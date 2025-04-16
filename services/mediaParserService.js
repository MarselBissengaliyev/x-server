import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import { google } from 'googleapis'
import fetch from 'node-fetch'
import crypto from 'crypto'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export class MediaParser {
  static async downloadFromUrl(url, mediaType = 'images') {
    const uploadsDir = path.join(__dirname, '..', 'uploads', mediaType)
    await fs.mkdir(uploadsDir, { recursive: true })

    const response = await fetch(url)
    if (!response.ok) throw new Error(`Failed to download: ${response.statusText}`)

    const contentType = response.headers.get('content-type')
    const ext = contentType.includes('image/') ? 
      `.${contentType.split('/')[1]}` : '.jpg'
    
    const fileName = `${crypto.randomBytes(8).toString('hex')}${ext}`
    const filePath = path.join(uploadsDir, fileName)
    
    const buffer = await response.buffer()
    await fs.writeFile(filePath, buffer)
    
    return filePath
  }

  static async parseFromGoogleDrive(folderId) {
    const auth = new google.auth.GoogleAuth({
      keyFile: path.join(__dirname, '..', 'config', 'google-credentials.json'),
      scopes: ['https://www.googleapis.com/auth/drive.readonly'],
    })

    const drive = google.drive({ version: 'v3', auth })
    
    const response = await drive.files.list({
      q: `'${folderId}' in parents and (mimeType contains 'image/' or mimeType contains 'video/')`,
      fields: 'files(id, name, mimeType, webContentLink)',
    })

    return response.data.files
  }

  static async downloadFromGDrive(fileId) {
    const auth = new google.auth.GoogleAuth({
      keyFile: path.join(__dirname, '..', 'config', 'google-credentials.json'),
      scopes: ['https://www.googleapis.com/auth/drive.readonly'],
    })

    const drive = google.drive({ version: 'v3', auth })
    const response = await drive.files.get(
      { fileId, alt: 'media' }, 
      { responseType: 'stream' }
    )

    const uploadsDir = path.join(__dirname, '..', 'uploads', 'gdrive')
    await fs.mkdir(uploadsDir, { recursive: true })
    
    const filePath = path.join(uploadsDir, `${fileId}.jpg`)
    const writer = fs.createWriteStream(filePath)
    
    return new Promise((resolve, reject) => {
      response.data
        .on('end', () => resolve(filePath))
        .on('error', reject)
        .pipe(writer)
    })
  }
}
