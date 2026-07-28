import { stickerSvg } from '../services/stickers'

// Renders a curated sticker (inline SVG) inside the round badge.
// When AI stickers land, `stickerId` may become a URL — handled here so nothing
// else has to change.
export function Sticker({
  id,
  size = 'md',
  className = '',
}: {
  id: string
  size?: 'md' | 'sm'
  className?: string
}) {
  const isUrl = /^(https?:|data:)/.test(id)
  return (
    <div className={`sticker ${size === 'sm' ? 'sm' : ''} ${className}`}>
      {isUrl ? (
        <img src={id} alt="" style={{ width: '78%', height: '78%', objectFit: 'contain' }} />
      ) : (
        <span dangerouslySetInnerHTML={{ __html: stickerSvg(id) }} />
      )}
    </div>
  )
}
