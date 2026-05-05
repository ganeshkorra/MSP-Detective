import { _decorator, Component, director } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('GlobalTimer') 
export class GlobalTimer extends Component {

    // --- CONFIGURATION ---
    public static readonly TOTAL_TIME: number = 90; 
    public static remainingTime: number = 90;

    // --- FIX: Re-adding isRunning for ItemController compatibility ---
    public static isRunning: boolean = false;
    
    // Internal Singleton
    private static _instance: GlobalTimer | null = null;

    @property
    public autoStartOnLoad: boolean = true; 

    onLoad() {
        if (GlobalTimer._instance && GlobalTimer._instance !== this) {
            console.log("TRACKING: Killing duplicate Timer node.");
            this.node.destroy();
            return;
        }

        GlobalTimer._instance = this;
        GlobalTimer.remainingTime = GlobalTimer.TOTAL_TIME;
        GlobalTimer.isRunning = false;

        director.addPersistRootNode(this.node);
        console.log("TRACKING: ✅ Timer System Online & Persistent.");

        if (this.autoStartOnLoad) {
            GlobalTimer.startTimer();
        }
    }

    public static startTimer() {
        if (this._instance && !this.isRunning) {
            this.isRunning = true;
            console.log("TRACKING: 🕒 Start Request Received.");
            
            // Clean slate
            this._instance.unschedule(this._instance.onSecondTick);
            
            // Run exactly once per second
            this._instance.schedule(this._instance.onSecondTick, 1.0);
            
            console.log("TRACKING: 🕒 Scheduler Started.");
        }
    }

    private onSecondTick() {
        GlobalTimer.remainingTime--;
        console.log(`TRACKING: ⏳ Tick... ${GlobalTimer.remainingTime}s`);

        if (GlobalTimer.remainingTime <= 0) {
            this.handleTimeUp();
        }
    }

    private handleTimeUp() {
        console.log("TRACKING: 🛑 TIME IS UP!");
        
        // Stop the scheduler
        this.unschedule(this.onSecondTick);
        
        GlobalTimer.remainingTime = 0;
        GlobalTimer.isRunning = false;
        
        // Fire event
        director.emit('TIME_UP');
    }
}