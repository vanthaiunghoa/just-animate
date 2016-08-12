import {each, map, pushAll, maxBy} from '../../common/lists';
import {expand, inherit} from '../../common/objects';
import {isArray, isDefined} from '../../common/type';
import {inRange} from '../../common/math';
import {queryElements} from '../../common/elements';
import {invalidArg} from '../../common/errors';
import {pipe} from '../../common/functions';
import {duration, finish, cancel, pause, nil} from '../../common/resources';
import {normalizeProperties, normalizeKeyframes, spaceKeyframes} from '../../common/keyframes';

import {Dispatcher, IDispatcher} from './Dispatcher';
import {MixinService} from './MixinService';
import {KeyframeAnimation} from './KeyframeAnimation';
import {ITimeLoop} from './TimeLoop';
import {easings} from '../../common/easings';

// fixme!: this controls the amount of time left before the timeline gives up 
// on individual animation and calls finish.  If an animation plays after its time, it looks
// like it restarts and that causes jank
const animationPadding = 1.0 / 30;

export class Animator implements ja.IAnimator {
    private _currentTime: number;
    private _dispatcher: IDispatcher;
    private _duration: number;
    private _events: ITimelineEvent[];
    private _playState: ja.AnimationPlaybackState;
    private _playbackRate: number;
    private _resolver: MixinService;
    private _timeLoop: ITimeLoop;

    constructor(resolver: MixinService, timeloop: ITimeLoop) {
        const self = this;
        if (!isDefined(duration)) {
            throw invalidArg(duration);
        }

        self._duration = 0;
        self._currentTime = nil;
        self._playState = 'idle';
        self._playbackRate = 1;
        self._events = [];
        self._resolver = resolver;
        self._timeLoop = timeloop;
        self._dispatcher = Dispatcher();
        self._onTick = self._onTick.bind(self);
        self.on(finish, self._onFinish);
        self.on(cancel, self._onCancel);
        self.on(pause, self._onPause);

        // autoplay    
        self.play();

        return self;
    }

    public animate(options: ja.IAnimationOptions | ja.IAnimationOptions[]): ja.IAnimator {
        const self = this;
        if (isArray(options)) {
            each(options as ja.IAnimationOptions[], (e: ja.IAnimationOptions) => self._addEvent(e));
        } else {
            self._addEvent(options as ja.IAnimationOptions);
        }
        self._recalculate();
        return self;
    }
    public duration(): number {
        return this._duration;
    }
    public currentTime(): number;
    public currentTime(value: number): ja.IAnimator;
    public currentTime(value?: number): number | ja.IAnimator {
        const self = this;
        if (!isDefined(value)) {
            return self._currentTime;
        }
        self._currentTime = value;
        return self;
    }
    public playbackRate(): number;
    public playbackRate(value: number): ja.IAnimator;
    public playbackRate(value?: number): number | ja.IAnimator {
        const self = this;
        if (!isDefined(value)) {
            return self._playbackRate;
        }
        self._playbackRate = value;
        return self;
    }
    public playState(): ja.AnimationPlaybackState;
    public playState(value: ja.AnimationPlaybackState): ja.IAnimator;
    public playState(value?: ja.AnimationPlaybackState): ja.AnimationPlaybackState | ja.IAnimator {
        const self = this;
        if (!isDefined(value)) {
            return self._playState;
        }
        self._playState = value;
        self._dispatcher.trigger('set', ['playbackState', value]);
        return self;
    }
    public on(eventName: string, listener: Function): ja.IAnimator {
        const self = this;
        self._dispatcher.on(eventName, listener);
        return self;
    }
    public off(eventName: string, listener: Function): ja.IAnimator {
        const self = this;
        self._dispatcher.off(eventName, listener);
        return self;
    }
    public finish(): ja.IAnimator {
        const self = this;
        self._dispatcher.trigger(finish, [self]);
        return self;
    }
    public play(): ja.IAnimator {
        const self = this;
        if (self._playState !== 'running' || self._playState !== 'pending') {
            self._playState = 'pending';
            self._timeLoop.on(self._onTick);
        }
        return self;
    }
    public pause(): ja.IAnimator {
        const self = this;
        self._dispatcher.trigger(pause, [self]);
        return self;
    }
    public reverse(): ja.IAnimator {
        const self = this;
        self._playbackRate *= -1;
        return self;
    }
    public cancel(): ja.IAnimator {
        const self = this;
        self._dispatcher.trigger(cancel, [self]);
        return self;
    }
    private _recalculate(): void {
        const self = this;
        const endsAt = maxBy(self._events, (e: ITimelineEvent) => e.startTimeMs + e.animator.totalDuration());
        self._duration = endsAt;
    }
    private _addEvent(event: ja.IAnimationOptions): void {
        const self = this;
        const targets = queryElements(event.targets);

        if (event.name) {
            const def = self._resolver.findAnimation(event.name);
            if (!isDefined(def)) {
                throw invalidArg('name');
            }
            inherit(event, def);
        }

        event.from = event.from || 0;
        event.to = event.to || 0;

        if (!event.easing) {
            event.easing = 'linear';
        } else {
            event.easing = easings[event.easing] || event.easing;
        }

        const animators = map(targets, (e: Element) => {
            const to = event.to + self._duration;
            const from = event.from + self._duration;
            const expanded = map(event.keyframes, expand as ja.IMapper<ja.ICssKeyframeOptions, ja.ICssKeyframeOptions>);
            const normalized = map(expanded, normalizeProperties);
            const keyframes = pipe(normalized, spaceKeyframes, normalizeKeyframes);

            return {
                animator: KeyframeAnimation(e, keyframes, event),
                endTimeMs: to,
                startTimeMs: from
            };
        });
        pushAll(self._events, animators);
    }
    private _onCancel(self: ja.IAnimator & IAnimationContext): void {
        self._timeLoop.off(self._onTick);
        self._currentTime = 0;
        self._playState = 'idle';
        each(self._events, (evt: ITimelineEvent) => { evt.animator.cancel(); });
    }
    private _onFinish(self: ja.IAnimator & IAnimationContext): void {
        self._timeLoop.off(self._onTick);
        self._currentTime = 0;
        self._playState = 'finished';
        each(self._events, (evt: ITimelineEvent) => { evt.animator.finish(); });
    }
    private _onPause(self: ja.IAnimator & IAnimationContext): void {
        self._timeLoop.off(self._onTick);
        self._playState = 'paused';
        each(self._events, (evt: ITimelineEvent) => { evt.animator.pause(); });
    }
    private _onTick(delta: number, runningTime: number): void {
        const self = this;
        const dispatcher = self._dispatcher;
        const playState = self._playState;

        // canceled
        if (playState === 'idle') {
            dispatcher.trigger(cancel, [self]);
            return;
        }
        // finished
        if (playState === 'finished') {
            dispatcher.trigger(finish, [self]);
            return;
        }
        // paused
        if (playState === 'paused') {
            dispatcher.trigger(pause, [self]);
            return;
        }
        // running/pending
        const playbackRate = self._playbackRate;
        const isReversed = playbackRate < 0;

        // calculate running range
        const duration1 = self._duration;
        const startTime = isReversed ? duration1 : 0;
        const endTime = isReversed ? 0 : duration1;

        if (self._playState === 'pending') {
            const currentTime = self._currentTime;
            self._currentTime = currentTime === nil || currentTime === endTime ? startTime : currentTime;
            self._playState = 'running';
        }

        // calculate currentTime from delta
        const currentTime = self._currentTime + delta * playbackRate;
        self._currentTime = currentTime;

        // check if animation has finished
        if (!inRange(currentTime, startTime, endTime)) {
            dispatcher.trigger(finish, [self]);
            return;
        }

        // start animations if should be active and currently aren't   
        const events = self._events;
        const eventLength = events.length;
        for (let i = 0; i < eventLength; i++) {
            const evt = events[i];
            const startTimeMs = playbackRate < 0 ? evt.startTimeMs : evt.startTimeMs + animationPadding;
            const endTimeMs = playbackRate >= 0 ? evt.endTimeMs : evt.endTimeMs - animationPadding;
            const shouldBeActive = startTimeMs <= currentTime && currentTime < endTimeMs;

            if (shouldBeActive) {
                const animator = evt.animator;
                animator.playbackRate(playbackRate);
                animator.play();
            }
        }
    }
}


interface IAnimationContext {
    _currentTime: number;
    _dispatcher: IDispatcher;
    _duration: number;
    _events: ITimelineEvent[];
    _onTick: { (delta: number, runningTime: number): void; };
    _playState: ja.AnimationPlaybackState;
    _playbackRate: number;
    _resolver: MixinService;
    _timeLoop: ITimeLoop;
}

interface ITimelineEvent {
    startTimeMs: number;
    endTimeMs: number;
    animator: ja.IAnimationController;
}