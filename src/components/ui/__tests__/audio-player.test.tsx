import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import AudioPlayer, { AudioTrack } from '../audio-player';

// Create a shared mock audio element that will be set up in beforeEach
let mockAudio: any;

// Access the global spies and state
const getMediaSpies = () => (global as any)._mediaElementSpies || {};
const getMediaState = () => (global as any)._mediaElementState || {};

const mockTracks: AudioTrack[] = [
  {
    id: '1',
    title: 'Test Song 1',
    artist: 'Test Artist',
    url: 'https://example.com/song1.mp3',
    duration: 180,
    thumbnailUrl: 'https://example.com/thumb1.jpg',
  },
  {
    id: '2',
    title: 'Test Song 2',
    artist: 'Test Artist',
    url: 'https://example.com/song2.mp3',
    duration: 240,
  },
];

describe('AudioPlayer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Clear global spies
    const globalSpies = (global as any)._mediaElementSpies;
    if (globalSpies) {
      globalSpies.load.mockClear();
      globalSpies.play.mockClear();
      globalSpies.pause.mockClear();
    }
    // Create a new mock audio instance for each test
    mockAudio = new (global as any).HTMLAudioElement();
  });

  it('renders with single track', async () => {
    await act(async () => {
      render(<AudioPlayer tracks={[mockTracks[0]]} />);
    });

    expect(screen.getByText('Test Song 1')).toBeInTheDocument();
    expect(screen.getByText('Test Artist')).toBeInTheDocument();
    expect(screen.getByLabelText('Play')).toBeInTheDocument();
  });

  it('renders with multiple tracks and shows track counter', async () => {
    await act(async () => {
      render(<AudioPlayer tracks={mockTracks} />);
    });

    // Track counter text is split across elements, check the entire content
    expect(screen.getByText(/Track\s+1\s+of\s+2/)).toBeInTheDocument();
    expect(screen.getByLabelText('Previous track')).toBeInTheDocument();
    expect(screen.getByLabelText('Next track')).toBeInTheDocument();
  });

  it('displays thumbnail when available', async () => {
    await act(async () => {
      render(<AudioPlayer tracks={[mockTracks[0]]} />);
    });

    // The thumbnail should be present with the correct src
    const thumbnail = document.querySelector('img[src="https://example.com/thumb1.jpg"]');
    expect(thumbnail).toBeInTheDocument();
    expect(thumbnail).toHaveAttribute('src', 'https://example.com/thumb1.jpg');
    expect(thumbnail).toHaveAttribute('aria-hidden', 'true');
  });

  it('handles play/pause functionality', async () => {
    const onPlayStateChange = jest.fn();

    await act(async () => {
      render(<AudioPlayer tracks={[mockTracks[0]]} onPlayStateChange={onPlayStateChange} />);
    });

    // Simulate audio loaded data to enable play button
    await act(async () => {
      const audioElement = screen.getByRole('region').querySelector('audio');
      if (audioElement && audioElement.simulateLoadedData) {
        audioElement.simulateLoadedData(180);
      }
    });

    // Wait for component to finish loading
    await waitFor(() => {
      expect(screen.getByLabelText('Play')).not.toBeDisabled();
    });

    const playButton = screen.getByLabelText('Play');

    await act(async () => {
      fireEvent.click(playButton);
    });

    await waitFor(() => {
      const spies = getMediaSpies();
      expect(spies.play).toHaveBeenCalled();
      expect(onPlayStateChange).toHaveBeenCalledWith(true);
    });
  });

  it('handles track navigation', async () => {
    const onTrackChange = jest.fn();

    await act(async () => {
      render(<AudioPlayer tracks={mockTracks} onTrackChange={onTrackChange} />);
    });

    // Simulate audio loaded data to enable navigation buttons
    await act(async () => {
      const audioElement = screen.getByRole('region').querySelector('audio');
      if (audioElement && audioElement.simulateLoadedData) {
        audioElement.simulateLoadedData(180);
      }
    });

    const nextButton = screen.getByLabelText('Next track');

    // Wait for loading to complete and button to be enabled
    await waitFor(() => {
      expect(nextButton).not.toBeDisabled();
    });

    await act(async () => {
      fireEvent.click(nextButton);
    });

    expect(onTrackChange).toHaveBeenCalledWith(1);
  });

  it('disables previous button on first track', async () => {
    await act(async () => {
      render(<AudioPlayer tracks={mockTracks} currentTrackIndex={0} />);
    });

    const prevButton = screen.getByLabelText('Previous track');
    expect(prevButton).toBeDisabled();
  });

  it('disables next button on last track', async () => {
    await act(async () => {
      render(<AudioPlayer tracks={mockTracks} currentTrackIndex={1} />);
    });

    const nextButton = screen.getByLabelText('Next track');
    expect(nextButton).toBeDisabled();
  });

  it('handles volume control', async () => {
    await act(async () => {
      render(<AudioPlayer tracks={[mockTracks[0]]} />);
    });

    const volumeSlider = screen.getByLabelText('Volume');

    await act(async () => {
      fireEvent.change(volumeSlider, { target: { value: '0.5' } });
    });

    const mediaState = getMediaState();
    expect(mediaState.volume).toBe(0.5);
  });

  it('handles mute/unmute', async () => {
    await act(async () => {
      render(<AudioPlayer tracks={[mockTracks[0]]} />);
    });

    const muteButton = screen.getByLabelText('Mute');

    await act(async () => {
      fireEvent.click(muteButton);
    });

    const mediaState = getMediaState();
    expect(mediaState.volume).toBe(0);
  });

  it('formats time correctly', async () => {
    await act(async () => {
      render(<AudioPlayer tracks={[mockTracks[0]]} />);
    });

    // Should show 0:00 initially - there are multiple instances, get all
    const timeElements = screen.getAllByText('0:00');
    expect(timeElements.length).toBeGreaterThan(0);
  });

  it('handles progress bar clicks', async () => {
    mockAudio.duration = 180; // Set duration for the test

    await act(async () => {
      render(<AudioPlayer tracks={[mockTracks[0]]} />);
    });

    // Trigger loadeddata event to set duration on the actual DOM element
    await act(async () => {
      const audioElement = screen.getByRole('region').querySelector('audio');
      if (audioElement && audioElement.simulateLoadedData) {
        audioElement.simulateLoadedData(180);
      }
    });

    // Find progress bar by aria-label
    const progressBar = screen.getByLabelText('Audio progress');

    // Mock getBoundingClientRect for progress bar
    jest.spyOn(progressBar, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      width: 100,
      top: 0,
      right: 100,
      bottom: 10,
      height: 10,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    await act(async () => {
      fireEvent.click(progressBar, { clientX: 50 });
    });

    const mediaState = getMediaState();

    // Should seek to middle of track
    expect(mediaState.currentTime).toBe(90); // 50% of 180 seconds
  });

  it('shows error message when audio fails to load', async () => {
    await act(async () => {
      render(<AudioPlayer tracks={[mockTracks[0]]} />);
    });

    // Simulate an error on the actual DOM element
    await act(async () => {
      const audioElement = screen.getByRole('region').querySelector('audio');
      if (audioElement && audioElement.simulateError) {
        audioElement.simulateError();
      }
    });

    await waitFor(() => {
      expect(screen.getByText('Failed to load audio')).toBeInTheDocument();
    });
  });

  it('shows loading state', async () => {
    await act(async () => {
      render(<AudioPlayer tracks={[mockTracks[0]]} />);
    });

    // The component starts in loading state
    expect(screen.getByText('Loading')).toBeInTheDocument();
    expect(screen.getByLabelText('Play')).toBeDisabled();
  });

  it('handles empty tracks array', async () => {
    await act(async () => {
      render(<AudioPlayer tracks={[]} />);
    });

    expect(screen.getByText('No audio track available')).toBeInTheDocument();
  });

  it('auto-advances to next track when current track ends', async () => {
    const onTrackChange = jest.fn();

    await act(async () => {
      render(
        <AudioPlayer tracks={mockTracks} currentTrackIndex={0} onTrackChange={onTrackChange} />
      );
    });

    // Simulate track ending on the actual DOM element
    await act(async () => {
      const audioElement = screen.getByRole('region').querySelector('audio');
      if (audioElement && audioElement.simulateEnded) {
        audioElement.simulateEnded();
      }
    });

    // Track should auto-advance when ended
    await waitFor(() => {
      expect(onTrackChange).toHaveBeenCalledWith(1);
    });
  });
});
