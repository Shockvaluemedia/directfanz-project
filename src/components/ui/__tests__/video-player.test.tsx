import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import VideoPlayer, { VideoTrack } from '../video-player'

// Use global media element spies from jest setup

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
    
    // Reset global media element spies and state
    if (global._mediaElementSpies) {
      global._mediaElementSpies.load.mockClear()
      global._mediaElementSpies.play.mockClear()
      global._mediaElementSpies.pause.mockClear()
    }
    
    if (global._mediaElementState) {
      global._mediaElementState.volume = 1
      global._mediaElementState.currentTime = 0
      global._mediaElementState.duration = 0
    }
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
    
    const video = screen.getByLabelText('Test Video by Test Artist')
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
    
    // Get the actual video element and simulate loaded data first
    const videoElement = document.querySelector('video')
    if (videoElement && videoElement.simulateLoadedData) {
      act(() => {
        videoElement.simulateLoadedData(300) // 5 minutes
      })
    }
    
    const playButton = screen.getByLabelText('Play')
    fireEvent.click(playButton)
    
    await waitFor(() => {
      expect(global._mediaElementSpies.play).toHaveBeenCalled()
      expect(onPlayStateChange).toHaveBeenCalledWith(true)
    })
  })

  it('handles video click to play/pause', async () => {
    render(<VideoPlayer video={mockVideoTrack} />)
    
    // Get the actual video element and simulate loaded data first
    const videoElement = document.querySelector('video')
    if (videoElement && videoElement.simulateLoadedData) {
      act(() => {
        videoElement.simulateLoadedData(300)
      })
    }
    
    const video = screen.getByLabelText('Test Video by Test Artist')
    fireEvent.click(video)
    
    await waitFor(() => {
      expect(global._mediaElementSpies.play).toHaveBeenCalled()
    })
  })

  it('handles volume control', () => {
    render(<VideoPlayer video={mockVideoTrack} />)
    
    const volumeSlider = screen.getByLabelText('Volume')
    fireEvent.change(volumeSlider, { target: { value: '0.7' } })
    
    // Check global state for volume
    expect(global._mediaElementState.volume).toBe(0.7)
  })

  it('handles mute/unmute', () => {
    render(<VideoPlayer video={mockVideoTrack} />)
    
    const muteButton = screen.getByLabelText('Mute')
    fireEvent.click(muteButton)
    
    // Check that volume is set to 0 (muted)
    expect(global._mediaElementState.volume).toBe(0)
  })

  it('handles fullscreen toggle', async () => {
    const mockContainer = {
      requestFullscreen: jest.fn().mockResolvedValue(undefined)
    }
    
    render(<VideoPlayer video={mockVideoTrack} />)
    
    // Mock the container ref
    const video = screen.getByLabelText('Test Video by Test Artist')
    const container = video.closest('div')
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
    
    // Get the actual video element and simulate loaded data first  
    const videoElement = document.querySelector('video')
    if (videoElement && videoElement.simulateLoadedData) {
      act(() => {
        videoElement.simulateLoadedData(300) // 5 minutes
      })
    }
    
    // Find progress bar (it's a div with click handler)
    const progressBar = screen.getByLabelText('Video progress')
    
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
    
    // Should seek to middle of video (150 seconds for 300 second video)
    expect(global._mediaElementState.currentTime).toBe(150)
  })

  it('shows loading spinner when buffering', async () => {
    render(<VideoPlayer video={mockVideoTrack} />)
    
    // Get the actual video element and trigger buffering (waiting) event
    const videoElement = document.querySelector('video')
    if (videoElement) {
      act(() => {
        // Simulate the waiting event (buffering)
        const waitingEvent = new Event('waiting')
        videoElement.dispatchEvent(waitingEvent)
      })
    }
    
    await waitFor(() => {
      // Should show loading spinner
      const spinner = document.querySelector('.animate-spin')
      expect(spinner).toBeInTheDocument()
    })
  })

  it('shows error message when video fails to load', async () => {
    render(<VideoPlayer video={mockVideoTrack} />)
    
    // Get the actual video element and trigger error event
    const videoElement = document.querySelector('video')
    if (videoElement && videoElement.simulateError) {
      act(() => {
        videoElement.simulateError()
      })
    }
    
    await waitFor(() => {
      expect(screen.getByText('Failed to load video')).toBeInTheDocument()
    })
  })

  it.skip('handles autoplay', async () => {
    // Create a spy on video element play method before the component creates it
    let videoPlaySpy: jest.SpyInstance | undefined
    const originalCreateElement = document.createElement
    
    document.createElement = function(tagName: any, options?: any) {
      const element = originalCreateElement.call(this, tagName, options)
      if (tagName.toLowerCase() === 'video') {
        // Mock the play method on the video element
        videoPlaySpy = jest.spyOn(element, 'play').mockImplementation(() => Promise.resolve())
      }
      return element
    }
    
    render(<VideoPlayer video={mockVideoTrack} autoPlay={true} />)
    
    // Wait for the useEffect to run and attempt autoplay
    await waitFor(() => {
      expect(videoPlaySpy).toHaveBeenCalled()
    })
    
    // Restore original createElement
    document.createElement = originalCreateElement
  })

  it('calls onPlayStateChange when video ends', async () => {
    const onPlayStateChange = jest.fn()
    
    render(
      <VideoPlayer 
        video={mockVideoTrack} 
        onPlayStateChange={onPlayStateChange}
      />
    )
    
    // Get the actual video element and simulate ended event
    const videoElement = document.querySelector('video')
    if (videoElement && videoElement.simulateEnded) {
      act(() => {
        videoElement.simulateEnded()
      })
    }
    
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
    
    const video = screen.getByLabelText('Test Video by Test Artist')
    const container = video.closest('div')
    
    if (container) {
      // Mouse enter should show controls
      fireEvent.mouseEnter(container)
      
      // Controls should be visible (opacity-100)
      const controls = container.querySelector('.opacity-100')
      expect(controls).toBeInTheDocument()
    }
  })
})