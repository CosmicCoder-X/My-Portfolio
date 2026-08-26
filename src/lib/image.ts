const CDN = '/.netlify/images'

type ImageOptions = {
  width: number
  height?: number
  fit?: 'contain' | 'cover' | 'fill'
  quality?: number
  position?: 'center' | 'top' | 'bottom' | 'left' | 'right'
}

export function optimizedImage(url: string, options: ImageOptions) {
  const params = new URLSearchParams({ url, w: String(options.width) })
  if (options.height) params.set('h', String(options.height))
  if (options.fit) params.set('fit', options.fit)
  if (options.position) params.set('position', options.position)
  params.set('q', String(options.quality ?? 78))
  return `${CDN}?${params.toString()}`
}

export function optimizedSrcSet(
  url: string,
  widths: Array<number>,
  options: Omit<ImageOptions, 'width'> = {},
) {
  return widths
    .map((w) => `${optimizedImage(url, { ...options, width: w })} ${w}w`)
    .join(', ')
}
