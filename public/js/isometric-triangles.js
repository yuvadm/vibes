// Isometric Triangles Script
document.addEventListener("DOMContentLoaded", function () {
    const colors = [
        "#FF0000",
        "#FF00FF",
        "#FF00AA",
        "#AA00FF",
        "#0000FF",
        "#00AAFF",
        "#00FFFF",
        "#00FFAA",
        "#00FF00",
        "#AAFF00",
        "#FFFF00",
        "#FFAA00",
        "#FF6600",
        "#FF0066",
        "#FFFFFF",
        "#AAAAFF",
    ];

    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    const triangleCount = Math.max(
        50,
        Math.floor((windowWidth * windowHeight) / 10000),
    );

    // Create triangles using DOM elements with isometric perspective
    for (let i = 0; i < triangleCount; i++) {
        createIsometricTriangle();
    }

    function createIsometricTriangle() {
        const triangle = document.createElement("div");
        triangle.className = "triangle isometric";

        // Random size between 50 and 150
        const size = 50 + Math.random() * 100;

        // Random position
        const left = Math.random() * windowWidth;
        const top = Math.random() * windowHeight;

        // Random color
        const color =
            colors[Math.floor(Math.random() * colors.length)];

        // Random rotation for isometric effect
        const rotateX = -30 + Math.random() * 60; // -30 to 30 degrees
        const rotateY = -30 + Math.random() * 60; // -30 to 30 degrees
        const rotateZ = Math.random() * 360; // 0 to 360 degrees

        // Random animation duration
        const duration = 10 + Math.random() * 40;

        // Random direction
        const direction =
            Math.random() > 0.5 ? "normal" : "reverse";

        // Set triangle properties
        triangle.style.left = `${left}px`;
        triangle.style.top = `${top}px`;
        triangle.style.width = `${size}px`;
        triangle.style.height = `${size}px`;
        triangle.style.backgroundColor = color;
        triangle.style.transform = `rotateX(${rotateX}deg) rotateY(${rotateY}deg) rotateZ(${rotateZ}deg)`;
        triangle.style.animationDuration = `${duration}s`;
        triangle.style.animationDirection = direction;

        // Add to body
        document.body.appendChild(triangle);
    }

    // Add some triangles when mouse moves
    document.addEventListener("mousemove", function (e) {
        if (Math.random() < 0.05) {
            // 5% chance to create a triangle on mouse move
            const triangle = document.createElement("div");
            triangle.className = "triangle isometric";

            const size = 50 + Math.random() * 100;
            const color =
                colors[Math.floor(Math.random() * colors.length)];

            // Random rotation for isometric effect
            const rotateX = -30 + Math.random() * 60;
            const rotateY = -30 + Math.random() * 60;
            const rotateZ = Math.random() * 360;

            triangle.style.left = `${e.clientX - size / 2}px`;
            triangle.style.top = `${e.clientY - size / 2}px`;
            triangle.style.width = `${size}px`;
            triangle.style.height = `${size}px`;
            triangle.style.backgroundColor = color;
            triangle.style.transform = `rotateX(${rotateX}deg) rotateY(${rotateY}deg) rotateZ(${rotateZ}deg)`;
            triangle.style.animationDuration = `${10 + Math.random() * 40}s`;
            triangle.style.animationDirection =
                Math.random() > 0.5 ? "normal" : "reverse";

            document.body.appendChild(triangle);
        }
    });

    // Handle window resize
    window.addEventListener("resize", function () {
        // Clear all existing triangles
        const existingTriangles =
            document.querySelectorAll(".triangle");
        existingTriangles.forEach((triangle) => {
            document.body.removeChild(triangle);
        });

        // Create new triangles based on new window size
        const newWindowWidth = window.innerWidth;
        const newWindowHeight = window.innerHeight;
        const newTriangleCount = Math.max(
            50,
            Math.floor((newWindowWidth * newWindowHeight) / 10000),
        );

        for (let i = 0; i < newTriangleCount; i++) {
            createIsometricTriangle();
        }
    });
});
