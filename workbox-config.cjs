module.exports = {
	globDirectory: 'dist/',
	globPatterns: [
		'**/*.{html,js,css,png,jpg,jpeg,svg,woff,woff2,ttf,eot,ico,json}'
	],
	swDest: 'dist/sw.js',
	ignoreURLParametersMatching: [
		/^utm_/,
		/^fbclid$/
	],
	// Configuración de runtime caching
	runtimeCaching: [
		{
			urlPattern: /^https:\/\/fonts\.googleapis\.com/,
			handler: 'StaleWhileRevalidate',
			options: {
				cacheName: 'google-fonts-stylesheets',
			},
		},
		{
			urlPattern: /^https:\/\/fonts\.gstatic\.com/,
			handler: 'CacheFirst',
			options: {
				cacheName: 'google-fonts-webfonts',
				expiration: {
					maxEntries: 30,
					maxAgeSeconds: 60 * 60 * 24 * 365, // 1 año
				},
			},
		},
		{
			urlPattern: /\.(?:png|jpg|jpeg|svg|gif)$/,
			handler: 'CacheFirst',
			options: {
				cacheName: 'images',
				expiration: {
					maxEntries: 50,
					maxAgeSeconds: 60 * 60 * 24 * 30, // 30 días
				},
			},
		},
	],
	// Configuración adicional
	skipWaiting: true,
	clientsClaim: true,
};