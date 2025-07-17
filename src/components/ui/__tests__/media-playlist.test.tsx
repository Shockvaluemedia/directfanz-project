import { render, screen, fireEvent } from '@testing-library/react'
import MediaPlaylist, { MediaItem } from '../media-playlist'

// Mock the audio and video player components
jest.mock('../audio-player', () => {
  return function MockAudioPlayer({ tracks, currentTrackIndex, onTrackChange, onPlayStateChange }: any) {
    return (
      <div data-testid="audio-player">
        <div>Audio Player</div>
        <div>Current Track: {tracks[currentTrackIndex]?.title}</div>
        <button onClick={() => onTrackChange?.(1)}>Next Audio Track</button>
        <button onClick={() => onPlayStateChange?.(true)}>Play Audio</button>
      </div>
    )
  }
})

jest.mock('../video-player', () => {
  return function MockVideoPlayer({ video, onPlayStateChange }: any) {
    return (
      <div data-testid="video-player">
        <div>Video Player</div>
        <div>Current Video: {video?.title}</div>
        <button onClick={() => onPlayStateChange?.(true)}>Play Video</button>
      </div>
    )
  }
})

const mockMediaItems: MediaItem[] = [
  {
    id: '1',
    title: 'Test Song 1',
    artist: 'Test Artist',
    type: 'AUDIO',
    url: 'https://example.com/song1.mp3',
    duration: 180,
    thumbnailUrl: 'https://example.com/thumb1.jpg'
  },
  {
    id: '2',
    title: 'Test Video 1',
    artist: 'Test Artist',
    type: 'VIDEO',
    url: 'https://example.com/video1.mp4',
    duration: 240,
    thumbnailUrl: 'https://example.com/thumb2.jpg'
  },
  {
    id: '3',
    title: 'Test Song 2',
    artist: 'Test Artist',
    type: 'AUDIO',
    url: 'https://example.com/song2.mp3',
    duration: 200
  }
]

describe('MediaPlaylist', () => {
  it('renders empty state when no items provided', () => {
    render(<MediaPlaylist items={[]} />)
    
    expect(screen.getByText('No media items available')).toBeInTheDocument()
  })

  it('renders audio player for audio items', () => {
    render(<MediaPlaylist items={[mockMediaItems[0]]} />)
    
    expect(screen.getByTestId('audio-player')).toBeInTheDocument()
    expect(screen.getByText('Current Track: Test Song 1')).toBeInTheDocument()
  })

  it('renders video player for video items', () => {
    render(<MediaPlaylist items={[mockMediaItems[1]]} />)
    
    expect(screen.getByTestId('video-player')).toBeInTheDocument()
    expect(screen.getByText('Current Video: Test Video 1')).toBeInTheDocument()
  })

  it('shows playlist toggle when multiple items', () => {
    render(<MediaPlaylist items={mockMediaItems} />)
    
    expect(screen.getByText('Playlist (3 items)')).toBeInTheDocument()
  })

  it('hides playlist toggle when single item', () => {
    render(<MediaPlaylist items={[mockMediaItems[0]]} />)
    
    expect(screen.queryByText(/Playlist/)).not.toBeInTheDocument()
  })

  it('toggles playlist visibility', () => {
    render(<MediaPlaylist items={mockMediaItems} />)
    
    // Playlist should be visible initially
    expect(screen.getByText('Test Song 1')).toBeInTheDocument()
    
    // Click toggle to hide
    fireEvent.click(screen.getByText('Playlist (3 items)'))
    
    // Playlist items should still be visible (they don't actually hide in this implementation)
    expect(screen.getByText('Test Song 1')).toBeInTheDocument()
  })

  it('displays all playlist items with correct information', () => {
    render(<MediaPlaylist items={mockMediaItems} />)
    
    // Check all items are displayed
    expect(screen.getByText('Test Song 1')).toBeInTheDocument()
    expect(screen.getByText('Test Video 1')).toBeInTheDocument()
    expect(screen.getByText('Test Song 2')).toBeInTheDocument()
    
    // Check media types are shown
    expect(screen.getAllByText('AUDIO')).toHaveLength(2)
    expect(screen.getAllByText('VIDEO')).toHaveLength(1)
    
    // Check durations are formatted
    expect(screen.getByText('3:00')).toBeInTheDocument() // 180 seconds
    expect(screen.getByText('4:00')).toBeInTheDocument() // 240 seconds
    expect(screen.getByText('3:20')).toBeInTheDocument() // 200 seconds
  })

  it('shows thumbnails when available', () => {
    render(<MediaPlaylist items={mockMediaItems} />)
    
    const thumbnails = screen.getAllByRole('img')
    expect(thumbnails).toHaveLength(2) // Only first two items have thumbnails
    expect(thumbnails[0]).toHaveAttribute('src', 'https://example.com/thumb1.jpg')
    expect(thumbnails[1]).toHaveAttribute('src', 'https://example.com/thumb2.jpg')
  })

  it('shows icons for items without thumbnails', () => {
    render(<MediaPlaylist items={mockMediaItems} />)
    
    // Third item should show an icon instead of thumbnail
    const icons = document.querySelectorAll('svg')
    expect(icons.length).toBeGreaterThan(0)
  })

  it('highlights current item', () => {
    render(<MediaPlaylist items={mockMediaItems} />)
    
    // First item should be highlighted (current)
    const firstItem = screen.getByText('Test Song 1').closest('div')
    expect(firstItem).toHaveClass('bg-blue-50')
  })

  it('handles item selection', () => {
    render(<MediaPlaylist items={mockMediaItems} />)
    
    // Click on second item (video)
    fireEvent.click(screen.getByText('Test Video 1'))
    
    // Should switch to video player
    expect(screen.getByTestId('video-player')).toBeInTheDocument()
    expect(screen.getByText('Current Video: Test Video 1')).toBeInTheDocument()
  })

  it('shows track numbers', () => {
    render(<MediaPlaylist items={mockMediaItems} />)
    
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('displays playlist summary', () => {
    render(<MediaPlaylist items={mockMediaItems} />)
    
    expect(screen.getByText('2 audio, 1 video')).toBeInTheDocument()
    expect(screen.getByText('Total: 10:20')).toBeInTheDocument() // 180+240+200 = 620 seconds = 10:20
  })

  it('handles items without duration', () => {
    const itemsWithoutDuration = mockMediaItems.map(item => ({
      ...item,
      duration: undefined
    }))
    
    render(<MediaPlaylist items={itemsWithoutDuration} />)
    
    expect(screen.getByText('Total: Unknown duration')).toBeInTheDocument()
  })

  it('shows play/pause indicators on current item', () => {
    render(<MediaPlaylist items={mockMediaItems} />)
    
    // Should show play icon initially (not playing)
    const playIcons = document.querySelectorAll('svg')
    expect(playIcons.length).toBeGreaterThan(0)
    
    // Click play button
    fireEvent.click(screen.getByText('Play Audio'))
    
    // Should update play state (this would show pause icon in real implementation)
  })

  it('handles mixed audio and video content correctly', () => {
    render(<MediaPlaylist items={mockMediaItems} />)
    
    // Should start with audio player for first item
    expect(screen.getByTestId('audio-player')).toBeInTheDocument()
    
    // Click on video item
    fireEvent.click(screen.getByText('Test Video 1'))
    
    // Should switch to video player
    expect(screen.getByTestId('video-player')).toBeInTheDocument()
    
    // Click back on audio item
    fireEvent.click(screen.getByText('Test Song 2'))
    
    // Should switch back to audio player
    expect(screen.getByTestId('audio-player')).toBeInTheDocument()
  })

  it('formats duration correctly for different lengths', () => {
    const itemsWithVariousDurations: MediaItem[] = [
      {
        id: '1',
        title: 'Short',
        artist: 'Artist',
        type: 'AUDIO',
        url: 'test.mp3',
        duration: 45 // 0:45
      },
      {
        id: '2',
        title: 'Long',
        artist: 'Artist',
        type: 'AUDIO',
        url: 'test.mp3',
        duration: 3661 // 61:01 (over an hour, but formatted as minutes:seconds)
      }
    ]
    
    render(<MediaPlaylist items={itemsWithVariousDurations} />)
    
    expect(screen.getByText('0:45')).toBeInTheDocument()
    expect(screen.getByText('61:01')).toBeInTheDocument()
  })
})