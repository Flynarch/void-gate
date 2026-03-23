import Phaser from "phaser";
import { gameConfig } from "./config.js";
import "./style.css";
import { inject } from '@vercel/analytics';

// Initialize Vercel Web Analytics
inject();

new Phaser.Game(gameConfig);
