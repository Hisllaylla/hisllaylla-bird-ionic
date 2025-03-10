// Get the canvas and context
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

// Game settings - easier gameplay
const GRAVITY = 0.4;
const BIRD_WIDTH = 34;
const BIRD_HEIGHT = 24;
const PIPE_WIDTH = 50;
const PIPE_GAP = 120;
const PIPE_SPEED = 1.5;

// Bird state
let bird = {
  x: 50,
  y: canvas.height / 2,
  velocity: 0,
  jumpStrength: -6,
};

// Pipes array
let pipes = [];
let frameCount = 0;
let score = 0;
let gameOver = false;

// Listen for user input for bird jump
document.addEventListener("keydown", jump);
canvas.addEventListener("click", jump);

function jump(e) {
  if (!gameOver) {
    bird.velocity = bird.jumpStrength;
  } else {
    // Restart game on input when game over
    resetGame();
  }
}

// Reset game function
function resetGame() {
  bird = {
    x: 50,
    y: canvas.height / 2,
    velocity: 0,
    jumpStrength: -6,
  };
  pipes = [];
  frameCount = 0;
  score = 0;
  gameOver = false;
  loop();
}

// Update game states
function update() {
  bird.velocity += GRAVITY;
  bird.y += bird.velocity;

  // Add pipes every 90 frames (~1.5 sec at 60fps)
  if (frameCount % 90 === 0) {
    // Random gap position between 50 and canvas.height -50
    const minPipeHeight = 20;
    const maxPipeTop = canvas.height - PIPE_GAP - minPipeHeight;
    const gapStart = Math.floor(Math.random() * (maxPipeTop - 50 + 1)) + 50;
    pipes.push({
      x: canvas.width,
      gapStart: gapStart,
    });
  }

  // Update pipes positions
  pipes.forEach((pipe) => {
    pipe.x -= PIPE_SPEED;
  });

  // Remove pipes that go off screen and update score
  if (pipes.length && pipes[0].x + PIPE_WIDTH < 0) {
    pipes.shift();
    score++;
  }

  // Collision detection
  for (let i = 0; i < pipes.length; i++) {
    const pipe = pipes[i];
    // Top pipe collision
    if (
      bird.x + BIRD_WIDTH > pipe.x &&
      bird.x < pipe.x + PIPE_WIDTH &&
      bird.y < pipe.gapStart
    ) {
      gameOver = true;
    }
    // Bottom pipe collision
    if (
      bird.x + BIRD_WIDTH > pipe.x &&
      bird.x < pipe.x + PIPE_WIDTH &&
      bird.y + BIRD_HEIGHT > pipe.gapStart + PIPE_GAP
    ) {
      gameOver = true;
    }
  }

  // Check if bird hit the ground or flew off top
  if (bird.y + BIRD_HEIGHT > canvas.height || bird.y < 0) {
    gameOver = true;
  }

  frameCount++;
}

// Draw game states
function draw() {
  // Clear the canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Draw background
  ctx.fillStyle = "#70c5ce";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Draw bird
  ctx.fillStyle = "#FF0";
  ctx.fillRect(bird.x, bird.y, BIRD_WIDTH, BIRD_HEIGHT);

  // Draw pipes
  ctx.fillStyle = "#228B22";
  pipes.forEach((pipe) => {
    // Top pipe
    ctx.fillRect(pipe.x, 0, PIPE_WIDTH, pipe.gapStart);
    // Bottom pipe
    ctx.fillRect(
      pipe.x,
      pipe.gapStart + PIPE_GAP,
      PIPE_WIDTH,
      canvas.height - pipe.gapStart - PIPE_GAP
    );
  });

  // Create overlay if game is over
  if (gameOver) {
    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#FFF";
    ctx.font = "30px Arial";
    ctx.textAlign = "center";
    ctx.fillText("Game Over", canvas.width / 2, canvas.height / 2 - 20);
    ctx.font = "20px Arial";
    ctx.fillText("Press any key or click to restart", canvas.width / 2, canvas.height / 2 + 20);
  }

  // Draw score over any overlay
  ctx.fillStyle = "#000";
  ctx.font = "20px Arial";
  ctx.textAlign = "left";
  ctx.fillText("Score: " + score, 10, 25);
}

// Main game loop
function loop() {
  update();
  draw();
  if (!gameOver) {
    requestAnimationFrame(loop);
  }
}

// Start the game loop
loop();