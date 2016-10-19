import { finished, paused, running, idle, nil } from '../../common/resources';

/**
 * Implements the IAnimationController interface for the Web Animation API
 * 
 * @export
 * @class KeyframeAnimator
 * @implements {ja.IAnimationController}
 */
export class KeyframeAnimator implements ja.IAnimationController {
    public totalDuration: number;
    private _initialized: boolean;
    private _init: ja.Resolvable<waapi.IAnimation>;
    private _animator: waapi.IAnimation;

    constructor(init: ja.Resolvable<waapi.IAnimation>) {
        this._init = init;
        this._initialized = nil;
    }

    public seek(value: number): void {
        this._ensureInit();
        if (this._animator.currentTime !== value) {
            this._animator.currentTime = value;
        }
    }
    public playbackRate(value: number): void {
        this._ensureInit();
        if (this._animator.playbackRate !== value) {
            this._animator.playbackRate = value;
        }
    }
    public reverse(): void {
        this._ensureInit();
        this._animator.playbackRate *= -1;
    }
    public restart(): void {
        const animator = this._animator;
        animator.cancel();
        animator.play();
    }
    public playState(): ja.AnimationPlaybackState;
    public playState(value: ja.AnimationPlaybackState): void;
    public playState(value?: ja.AnimationPlaybackState): ja.AnimationPlaybackState | void {
        const self = this;
        self._ensureInit();

        const animator = self._animator;
        const playState = !animator || self._initialized === false ? 'fatal' : animator.playState;
        if (value === nil) {
            return playState;
        }

        if (playState === 'fatal') {
            // do nothing
        } else if (value === finished) {
            animator.finish();
        } else if (value === idle) {
            animator.cancel();
        } else if (value === paused) {
            animator.pause();
        } else if (value === running) {
            animator.play();
        }
    }

    private _ensureInit(): void {
        const self = this;
        const init = self._init as ja.Resolver<waapi.IAnimation>;
        if (init) {
            self._init = nil;
            self._initialized = false;
            self._animator = init();
            self._initialized = true;
        }
    }
}

