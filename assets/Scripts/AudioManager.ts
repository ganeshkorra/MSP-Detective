// AudioManager.ts (with Diamond Sound)
import { _decorator, Component, Node, AudioClip, AudioSource, director } from 'cc';

const { ccclass, property } = _decorator;

@ccclass('AudioManager')
export class AudioManager extends Component {
    private static _instance: AudioManager = null;
    public static get instance(): AudioManager {
        if (!this._instance) {
            console.error("AudioManager instance is not yet available.");
        }
        return this._instance;
    }

    @property({ type: AudioSource }) public bgmSource: AudioSource = null;
    @property({ type: AudioSource }) public sfxSource: AudioSource = null;
    @property({ type: AudioClip }) public bgmClip: AudioClip = null;
    @property({ type: AudioClip }) public tapClip: AudioClip = null;
    @property({ type: AudioClip }) public dropClip: AudioClip = null;
    
    // --- NEW PROPERTY FOR DIAMOND SOUND ---
    @property({ type: AudioClip, tooltip: "Sound for when a diamond is collected." })
    public diamondClip: AudioClip = null;

    onLoad() {
        if (AudioManager._instance) {
            this.destroy();
            return;
        }
        AudioManager._instance = this;
        director.addPersistRootNode(this.node);
    }

    public playBgm() {
        if (this.bgmSource && this.bgmClip && !this.bgmSource.playing) {
            this.bgmSource.clip = this.bgmClip;
            this.bgmSource.loop = true;
            this.bgmSource.play();
        }
    }

    public playTapSound() { this.playSfx(this.tapClip); }
    public playDropSound() { this.playSfx(this.dropClip); }

    // --- NEW FUNCTION TO PLAY DIAMOND SOUND ---
    public playDiamondSound() {
        this.playSfx(this.diamondClip);
    }

    private playSfx(clip: AudioClip) {
        if (this.sfxSource && clip) {
            this.sfxSource.playOneShot(clip, 1.0);
        }
    }
}