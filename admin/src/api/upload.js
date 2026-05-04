import client from './client';

export function uploadFiles(formData, params = {}) {
  return client.post('/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    params,
    timeout: 120000,
  });
}

export function getMediaList(params) {
  return client.get('/media', { params });
}

export function deleteMedia(filePath) {
  return client.delete('/media', { data: { path: filePath } });
}
