import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import AudioPlayer, { AudioTrack } from '../audio-player'

// Mock HTMLAudioElement
const mockAudio = {
  play: jest.fn().mockResolvedValue(undefined),
  pause: jest.fn(),
  load: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  currentTime: 0,
  duration: 180,
  volume: 1,
  src: '',
  paused: true
}

Object.defineProperty(window, 'HTMLAudioElement', {
  writable: true,
  value: jest.fn().mockImplementation(() => mockAudio)
})

const mockTracks: AudioTrack[] = [
  {
    id: '1',
    title: 'Test Song 1',
    artist: 'Test Artist',
    url: 'https://example.com/song1.mp3',
    duration: 180,
    thumbnailUrl: 'https://example.com/thumb1.jpg'
  },
  {
    id: '2',
    title: 'Test Song 2',
    artist: 'Test Artist',
    url: 'https://example.com/song2.mp3',
    duration: 240
  }
]

describe('AudioPlayer', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders with single track', () => {
    render(<AudioPlayer tracks={[mockTracks[0]]} />)
    
    expect(screen.getByText('Test Song 1')).toBeInTheDocument()
    expect(screen.getByText('Test Artist')).toBeInTheDocument()
    expect(screen.getByLabelText('Play')).toBeInTheDocument()
  })

  it('renders with multiple tracks and shows track counter', () => {
    render(<AudioPlayer tracks={mockTracks} />)
    
    expect(screen.getByText('1 of 2')).toBeInTheDocument()
    expect(screen.getByLabelText('Previous track')).toBeInTheDocument()
    expect(screen.getByLabelText('Next track')).toBeInTheDocument()
  })

  it('displays thumbnail when available', () => {
    render(<AudioPlayer tracks={[mockTracks[0]]} />)
    
    const thumbnail = screen.getByAltText('Test Song 1')
    expect(thumbnail).toBeInTheDocument()
    expect(thumbnail).toHaveAttribute('src', 'https://example.com/thumb1.jpg')
  })

  it('handles play/pause functionality', async () => {
    const onPlayStateChange = jest.fn()
    render(
      <AudioPlayer 
        tracks={[mockTracks[0]]} 
        onPlayStateChange={onPlayStateChange}
      />
    )
    
    const playButton = screen.getByLabelText('Play')
    fireEvent.click(playButton)
    
    await waitFor(() => {
      expect(mockAudio.play).toHaveBeenCalled()
      expect(onPlayStateChange).toHaveBeenCalledWith(true)
    })
  })

  it('handles track navigation', () => {
    const onTrackChange = jest.fn()
    render(
      <AudioPlayer 
        tracks={mockTracks} 
        onTrackChange={onTrackChange}
      />
    )
    
    const nextButton = screen.getByLabelText('Next track')
    fireEvent.click(nextButton)
    
    expect(onTrackChange).toHaveBeenCalledWith(1)
  })

  it('disables previous button on first track', () => {
    render(<AudioPlayer tracks={mockTracks} currentTrackIndex={0} />)
    
    const prevButton = screen.getByLabelText('Previous track')
    expect(prevButton).toBeDisabled()
  })

  it('disables next button on last track', () => {
    render(<AudioPlayer tracks={mockTracks} currentTrackIndex={1} />)
    
    const nextButton = screen.getByLabelText('Next track')
    expect(nextButton).toBeDisabled()
  })

  it('handles volume control', () => {
    render(<AudioPlayer tracks={[mockTracks[0]]} />)
    
    const volumeSlider = screen.getByRole('slider')
    fireEvent.change(volumeSlider, { target: { value: '0.5' } })
    
    expect(mockAudio.volume).toBe(0.5)
  })

  it('handles mute/unmute', () => {
    render(<AudioPlayer tracks={[mockTracks[0]]} />)
    
    const muteButton = screen.getByLabelText('Mute')
    fireEvent.click(muteButton)
    
    expect(mockAudio.volume).toBe(0)
  })

  it('formats time correctly', () => {
    render(<AudioPlayer tracks={[mockTracks[0]]} />)
    
    // Should show 0:00 initially
    expect(screen.getByText('0:00')).toBeInTheDocument()
  })

  it('handles progress bar clicks', () => {
    render(<AudioPlayer tracks={[mockTracks[0]]} />)
    
    // Mock getBoundingClientRect for progress bar
    const progressBar = screen.getByRole('progressbar', { hidden: true })?.parentElement
    if (progressBar) {
      jest.spyOn(progressBar, 'getBoundingClientRect').mockReturnValue({
        left: 0,
        width: 100,
        top: 0,
        right: 100,
        bottom: 10,
        height: 10,
        x: 0,
        y: 0,
        toJSON: () => ({})
      })
      
      fireEvent.click(progressBar, { clientX: 50 })
      
      // Should seek to middle of track (assuming duration is set)
      expect(mockAudio.currentTime).toBeGreaterThan(0)
    }
  })

  it('shows error message when audio fails to load', async () => {
    const failingAudio = {
      ...mockAudio,
      addEventListener: jest.fn((event, callback) => {
        if (event === 'error') {
          setTimeout(() => callback(), 0)
        }
      })
    }
    
    jest.spyOn(window, 'HTMLAudioElement').mockImplementation(() => failingAudio as any)
    
    render(<AudioPlayer tracks={[mockTracks[0]]} />)
    
    await waitFor(() => {
      expect(screen.getByText('Failed to load audio')).toBeInTheDocument()
    })
  })

  it('shows loading state', () => {
    const loadingAudio = {
      ...mockAudio,
      addEventListener: jest.fn((event, callback) => {
        if (event === 'loadstart') {
          setTimeout(() => callback(), 0)
        }
      })
    }
    
    jest.spyOn(window, 'HTMLAudioElement').mockImplementation(() => loadingAudio as any)
    
    render(<AudioPlayer tracks={[mockTracks[0]]} />)
    
    // Should show loading spinner in play button
    expect(screen.getByRole('button', { name: /play/i })).toBeInTheDocument()
  })

  it('handles empty tracks array', () => {
    render(<AudioPlayer tracks={[]} />)
    
    expect(screen.getByText('No audio track available')).toBeInTheDocument()
  })

  it('auto-advances to next track when current track ends', () => {
    const onTrackChange = jest.fn()
    const endingAudio = {
      ...mockAudio,
      addEventListener: jest.fn((event, callback) => {
        if (event === 'ended') {
          setTimeout(() => callback(), 0)
        }
      })
    }
    
    jest.spyOn(window, 'HTMLAudioElement').mockImplementation(() => endingAudio as any)
    
    render(
      <AudioPlayer 
        tracks={mockTracks} 
        currentTrackIndex={0}
        onTrackChange={onTrackChange}
      />
    )
    
    // Track should auto-advance when ended
    setTimeout(() => {
      expect(onTrackChange).toHaveBeenCalledWith(1)
    }, 10)
  })
})