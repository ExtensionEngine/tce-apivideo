'use strict';

const { createSandBoxClient } = require('./apiVideo');
const { ELEMENT_STATE } = require('../shared');

function beforeSave(asset, { config: { tceApiVideo } }) {
  const { videoId, fileName, status } = asset.data;
  if (isError(status) || videoId || !fileName) return asset;
  const client = createSandBoxClient({ apiKey: tceApiVideo.apiKey });
  return client.videos.create(fileName)
    .then(({ videoId }) => {
      asset.data.playable = false;
      asset.data.videoId = videoId;
      return asset;
    })
    .catch(error => {
      asset.data.status = ELEMENT_STATE.ERROR;
      asset.data.error = error.message;
      return asset;
    });
}

async function afterSave(asset, { config: { tceApiVideo } }) {
  const { videoId, playable, status } = asset.data;
  if (isError(status) || !videoId || playable) return asset;
  const client = createSandBoxClient({ apiKey: tceApiVideo.apiKey });
  if (status === ELEMENT_STATE.UPLOADED) {
    const interval = setInterval(async () => {
      const {
        ingest: { status },
        encoding: { playable }
      } = await client.videos.status(videoId);
      if (status === 'uploaded' && playable) {
        clearInterval(interval);
        delete asset.data.uploadUrl;
        await asset.update({ data: { ...asset.data, playable: true } });
      }
    }, 5000);
  }
  asset.data.uploadUrl = await client.videos.getUploadUrl();
  return asset;
}

function afterLoaded(asset, { config: { tceApiVideo } }) {
  const { videoId, playable, status } = asset.data;
  if (isError(status) || !videoId || !playable) return asset;
  const client = createSandBoxClient({ apiKey: tceApiVideo.apiKey });
  return client.videos.get(videoId)
    .then(res => {
      asset.data.embedCode = res.assets.iframe;
      asset.data.url = res.assets.mp4;
      return asset;
    })
    .catch(error => {
      asset.data.status = ELEMENT_STATE.ERROR;
      asset.data.error = error.message;
      return asset;
    });
}

const isError = state => state === ELEMENT_STATE.ERROR;

module.exports = { beforeSave, afterSave, afterLoaded };
