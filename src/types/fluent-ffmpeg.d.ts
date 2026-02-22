declare module 'fluent-ffmpeg' {
  interface FfmpegCommand {
    audioCodec(codec: string): FfmpegCommand;
    audioBitrate(bitrate: number | string): FfmpegCommand;
    audioFrequency(freq: number): FfmpegCommand;
    videoCodec(codec: string): FfmpegCommand;
    videoBitrate(bitrate: number | string): FfmpegCommand;
    size(size: string): FfmpegCommand;
    aspect(ratio: string): FfmpegCommand;
    autopad(color?: string | boolean): FfmpegCommand;
    format(fmt: string): FfmpegCommand;
    outputOptions(options: string[]): FfmpegCommand;
    seekInput(time: number | string): FfmpegCommand;
    duration(duration: number | string): FfmpegCommand;
    noAudio(): FfmpegCommand;
    on(event: string, callback: (...args: any[]) => void): FfmpegCommand;
    save(output: string): FfmpegCommand;
    screenshot(options: any): FfmpegCommand;
    screenshots(options: any): FfmpegCommand;
    [key: string]: any;
  }

  interface FfprobeData {
    format: {
      duration?: number;
      size?: number;
      [key: string]: any;
    };
    streams: Array<{
      codec_type?: string;
      width?: number;
      height?: number;
      [key: string]: any;
    }>;
  }

  function ffmpeg(input?: string): FfmpegCommand;

  namespace ffmpeg {
    function setFfmpegPath(path: string): void;
    function ffprobe(
      file: string,
      callback: (err: Error | null, metadata: FfprobeData) => void
    ): void;
  }

  export = ffmpeg;
}
