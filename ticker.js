// Keep the authoritative clock independent from canvas rendering.
setInterval(() => postMessage(null), 1000 / 60);
