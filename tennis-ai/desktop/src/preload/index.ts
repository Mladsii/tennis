import { contextBridge } from 'electron'

contextBridge.exposeInMainWorld('env', {
  apiBaseUrl: 'http://localhost:8000/api/v1',
})
