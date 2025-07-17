import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import VideoPlayer, { VideoTrack } from '../video-player'

// Mock HTMLVideoElement
const mockVideo = {
  play: jest.fn().mockResolvedValue(undefined),
  pause: jest.fn(),
  load: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  requestFullscreen: jest.fn().mockResolvedValue(undefined),
  currentTime: 0,
  duration: 300,
  volume: 1,
  src: '',
  paused: true,
  poster: ''
}

Object.defineProperty(window, 'HTMLVideoElement', {
  writable: true,
  value: jest.fn().mockImplementation(() => mockVideo)
})

// Mock fullscreen API
Object.defineProperty(document, 'fullscreenElement', {
  writable: true,
  value: null
})

Object.defineProperty(document, 'exitFullscreen', {
  writable: true,
  value: jest.fn().mockResolvedValue(undefined)
})

const mockVideoTrack: VideoTrack = {
  id: '1',
  title: 'Test Video',
  artist: 'Test Artist',
  url: 'https://example.com/video.mp4',
  duration: 300,
  thumbnailUrl: 'https://example.com/thumb.jpg'
}

describe('VideoPlayer', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders video player with controls', () => {
    render(<VideoPlayer video={mockVideoTrack} />)
    
    expect(screen.getByText('Test Video')).toBeInTheDocument()
    expect(screen.getByText('Test Artist')).toBeInTheDocument()
    expect(screen.getByLabelText('Play')).toBeInTheDocument()
    expect(screen.getByLabelText('Enter fullscreen')).toBeInTheDocument()
  })

  it('renders without controls when disabled', () => {
    render(<VideoPlayer video={mockVideoTrack} controls={false} />)
    
    expect(screen.queryByLabelText('Play')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Enter fullscreen')).not.toBeInTheDocument()
  })

  it('shows poster image', () => {
    render(<VideoPlayer video={mockVideoTrack} />)
    
    const video = screen.getByRole('application') // video element
    expect(video).toHaveAttribute('poster', 'https://example.com/thumb.jpg')
  })

  it('handles play/pause functionality', async () => {
    const onPlayStateChange = jest.fn()
    render(
      <VideoPlayer 
        video={mockVideoTrack} 
        onPlayStateChange={onPlayStateChange}
      />
    )
    
    const playButton = screen.getByLabelText('Play')
    fireEvent.click(playButton)
    
    await waitFor(() => {
      expect(mockVideo.play).toHaveBeenCalled()
      expect(onPlayStateChange).toHaveBeenCalledWith(true)
    })
  })

  it('handles video click to play/pause', async () => {
    render(<VideoPlayer video={mockVideoTrack} />)
    
    const video = screen.getByRole('application')
    fireEvent.click(video)
    
    await waitFor(() => {
      expect(mockVideo.play).toHaveBeenCalled()
    })
  })

  it('handles volume control', () => {
    render(<VideoPlayer video={mockVideoTrack} />)
    
    const volumeSlider = screen.getByRole('slider')
    fireEvent.change(volumeSlider, { target: { value: '0.7' } })
    
    expect(mockVideo.volume).toBe(0.7)
  })

  it('handles mute/unmute', () => {
    render(<VideoPlayer video={mockVideoTrack} />)
    
    const muteButton = screen.getByLabelText('Mute')
    fireEvent.click(muteButton)
    
    expect(mockVideo.volume).toBe(0)
  })

  it('handles fullscreen toggle', async () => {
    const mockContainer = {
      requestFullscreen: jest.fn().mockResolvedValue(undefined)
    }
    
    render(<VideoPlayer video={mockVideoTrack} />)
    
    // Mock the container ref
    const container = screen.getByRole('application').closest('div')
    if (container) {
      Object.assign(container, mockContainer)
    }
    
    const fullscreenButton = screen.getByLabelText('Enter fullscreen')
    fireEvent.click(fullscreenButton)
    
    await waitFor(() => {
      expect(mockContainer.requestFullscreen).toHaveBeenCalled()
    })
  })

  it('formats time display correctly', () => {
    render(<VideoPlayer video={mockVideoTrack} />)
    
    // Should show 0:00 / 5:00 initially (300 seconds = 5 minutes)
    expect(screen.getByText(/0:00 \/ 5:00/)).toBeInTheDocument()
  })

  it('formats time with hours correctly', () => {
    const longVideo = {
      ...mockVideoTrack,
      duration: 3661 // 1 hour, 1 minute, 1 second
    }
    
    render(<VideoPlayer video={longVideo} />)
    
    // Should show hours format
    expect(screen.getByText(/0:00 \/ 1:01:01/)).toBeInTheDocument()
  })

  it('handles progress bar clicks', () => {
    render(<VideoPlayer video={mockVideoTrack} />)
    
    // Find progress bar (it's a div with click handler)
    const progressBars = screen.getAllByRole('generic')
    const progressBar = progressBars.find(el => 
      el.className.includes('cursor-pointer') && 
      el.className.includes('bg-white')
    )
    
    if (progressBar) {
      jest.spyOn(progressBar, 'getBoundingClientRect').mockReturnValue({
        left: 0,
        width: 100,
        top: 0,
        right: 100,
        bottom: 4,
        height: 4,
        x: 0,
        y: 0,
        toJSON: () => ({})
      })
      
      fireEvent.click(progressBar, { clientX: 50 })
      
      // Should seek to middle of video
      expect(mockVideo.currentTime).toBeGreaterThan(0)
    }
  })

  it('shows loading spinner when buffering', async () => {
    const bufferingVideo = {
      ...mockVideo,
      addEventListener: jest.fn((event, callback) => {
        if (event === 'waiting') {
          setTimeout(() => callback(), 0)
        }
      })
    }
    
    jest.spyOn(window, 'HTMLVideoElement').mockImplementation(() => bufferingVideo as any)
    
    render(<VideoPlayer video={mockVideoTrack} />)
    
    await waitFor(() => {
      // Should show loading spinner
      const spinner = document.querySelector('.animate-spin')
      expect(spinner).toBeInTheDocument()
    })
  })

  it('shows error message when video fails to load', async () => {
    const failingVideo = {
      ...mockVideo,
      addEventListener: jest.fn((event, callback) => {
        if (event === 'error') {
          setTimeout(() => callback(), 0)
        }
      })
    }
    
    jest.spyOn(window, 'HTMLVideoElement').mockImplementation(() => failingVideo as any)
    
    render(<VideoPlayer video={mockVideoTrack} />)
    
    await waitFor(() => {
      expect(screen.getByText('Failed to load video')).toBeInTheDocument()
    })
  })

  it('handles autoplay', () => {
    render(<VideoPlayer video={mockVideoTrack} autoPlay={true} />)
    
    // Should attempt to play automatically
    expect(mockVideo.play).toHaveBeenCalled()
  })

  it('calls onPlayStateChange when video ends', async () => {
    const onPlayStateChange = jest.fn()
    const endingVideo = {
      ...mockVideo,
      addEventListener: jest.fn((event, callback) => {
        if (event === 'ended') {
          setTimeout(() => callback(), 0)
        }
      })
    }
    
    jest.spyOn(window, 'HTMLVideoElement').mockImplementation(() => endingVideo as any)
    
    render(
      <VideoPlayer 
        video={mockVideoTrack} 
        onPlayStateChange={onPlayStateChange}
      />
    )
    
    await waitFor(() => {
      expect(onPlayStateChange).toHaveBeenCalledWith(false)
    })
  })

  it('shows play button overlay when paused', () => {
    render(<VideoPlayer video={mockVideoTrack} />)
    
    // Should show large play button overlay
    const playOverlay = screen.getByLabelText('Play video')
    expect(playOverlay).toBeInTheDocument()
  })

  it('handles mouse events for control visibility', () => {
    render(<VideoPlayer video={mockVideoTrack} />)
    
    const container = screen.getByRole('application').closest('div')
    
    if (container) {
      // Mouse enter should show controls
      fireEvent.mouseEnter(container)
      
      // Controls should be visible (opacity-100)
      const controls = container.querySelector('.opacity-100')
      expect(controls).toBeInTheDocument()
    }
  })
})