import { useState, useEffect, useCallback, useRef } from "react";

interface SensorStatus {
  accelerometer: boolean;
  gyroscope: boolean;
  geolocation: boolean;
  orientation: boolean;
  magnetometer: boolean;
  linear_acceleration: boolean;
  gravity: boolean;
  relative_orientation: boolean;
  ambient_light: boolean;
}

export const useSensors = (
  isRecording: boolean,
  onSensorData: (sensorType: string, data: any) => void
) => {
  const [sensorStatus, setSensorStatus] = useState<SensorStatus>({
    accelerometer: false,
    gyroscope: false,
    geolocation: false,
    orientation: false,
    magnetometer: false,
    linear_acceleration: false,
    gravity: false,
    relative_orientation: false,
    ambient_light: false,
  });

  const sensorsRef = useRef<{
    accelerometer?: any;
    gyroscope?: any;
    magnetometer?: any;
    linear_acceleration?: any;
    gravity?: any;
    relative_orientation?: any;
    ambient_light?: any;
    geolocationWatchId?: number;
  }>({});

  const checkSensorSupport = useCallback(async () => {
    const status: SensorStatus = {
      accelerometer: false,
      gyroscope: false,
      geolocation: false,
      orientation: false,
      magnetometer: false,
      linear_acceleration: false,
      gravity: false,
      relative_orientation: false,
      ambient_light: false,
    };

    // Check accelerometer
    if ("Accelerometer" in window) {
      try {
        const accel = new (window as any).Accelerometer({ frequency: 10 });
        status.accelerometer = true;
        accel.stop();
      } catch (e) {
        console.log("Accelerometer not available:", e);
      }
    }

    // Check gyroscope
    if ("Gyroscope" in window) {
      try {
        const gyro = new (window as any).Gyroscope({ frequency: 10 });
        status.gyroscope = true;
        gyro.stop();
      } catch (e) {
        console.log("Gyroscope not available:", e);
      }
    }

    // Check magnetometer
    if ("Magnetometer" in window) {
      try {
        const mag = new (window as any).Magnetometer({ frequency: 10 });
        status.magnetometer = true;
        mag.stop();
      } catch (e) {
        console.log("Magnetometer not available:", e);
      }
    }

    // Check linear acceleration
    if ("LinearAccelerationSensor" in window) {
      try {
        const linear = new (window as any).LinearAccelerationSensor({
          frequency: 10,
        });
        status.linear_acceleration = true;
        linear.stop();
      } catch (e) {
        console.log("LinearAccelerationSensor not available:", e);
      }
    }

    // Check gravity
    if ("GravitySensor" in window) {
      try {
        const grav = new (window as any).GravitySensor({ frequency: 10 });
        status.gravity = true;
        grav.stop();
      } catch (e) {
        console.log("GravitySensor not available:", e);
      }
    }

    // Check relative orientation
    if ("RelativeOrientationSensor" in window) {
      try {
        const relOrient = new (window as any).RelativeOrientationSensor({
          frequency: 10,
        });
        status.relative_orientation = true;
        relOrient.stop();
      } catch (e) {
        console.log("RelativeOrientationSensor not available:", e);
      }
    }

    // Check ambient light
    if ("AmbientLightSensor" in window) {
      try {
        const light = new (window as any).AmbientLightSensor({ frequency: 1 });
        status.ambient_light = true;
        light.stop();
      } catch (e) {
        console.log("AmbientLightSensor not available:", e);
      }
    }

    // Check geolocation
    if ("geolocation" in navigator) {
      status.geolocation = true;
    }

    // Check orientation
    if ("DeviceOrientationEvent" in window) {
      status.orientation = true;
    }

    setSensorStatus(status);
  }, []);

  useEffect(() => {
    checkSensorSupport();
  }, [checkSensorSupport]);

  const onSensorDataRef = useRef(onSensorData);
  onSensorDataRef.current = onSensorData;

  const stopAllSensors = useCallback(() => {
    const currentSensors = sensorsRef.current;
    console.log(currentSensors);
    console.log("stopping sensors");
    if (currentSensors.accelerometer) currentSensors.accelerometer.stop();
    if (currentSensors.gyroscope) currentSensors.gyroscope.stop();
    if (currentSensors.magnetometer) currentSensors.magnetometer.stop();
    if (currentSensors.linear_acceleration)
      currentSensors.linear_acceleration.stop();
    if (currentSensors.gravity) currentSensors.gravity.stop();
    if (currentSensors.relative_orientation)
      currentSensors.relative_orientation.stop();
    if (currentSensors.ambient_light) currentSensors.ambient_light.stop();
    if (currentSensors.geolocationWatchId !== undefined) {
      navigator.geolocation.clearWatch(currentSensors.geolocationWatchId);
    }
    sensorsRef.current = {};
  }, []);

  useEffect(() => {
    if (!isRecording) {
      stopAllSensors();
      return;
    }

    const newSensors: any = {};

    // Start accelerometer
    if (sensorStatus.accelerometer && "Accelerometer" in window) {
      try {
        const accel = new (window as any).Accelerometer({ frequency: 10 });
        accel.addEventListener("reading", () => {
          onSensorDataRef.current("accelerometer", {
            x: accel.x,
            y: accel.y,
            z: accel.z,
          });
        });
        accel.start();
        newSensors.accelerometer = accel;
      } catch (e) {
        console.error("Error starting accelerometer:", e);
      }
    }

    // Start gyroscope
    if (sensorStatus.gyroscope && "Gyroscope" in window) {
      try {
        const gyro = new (window as any).Gyroscope({ frequency: 10 });
        gyro.addEventListener("reading", () => {
          onSensorDataRef.current("gyroscope", {
            x: gyro.x,
            y: gyro.y,
            z: gyro.z,
          });
        });
        gyro.start();
        newSensors.gyroscope = gyro;
      } catch (e) {
        console.error("Error starting gyroscope:", e);
      }
    }

    // Start magnetometer
    if (sensorStatus.magnetometer && "Magnetometer" in window) {
      try {
        const mag = new (window as any).Magnetometer({ frequency: 10 });
        mag.addEventListener("reading", () => {
          onSensorDataRef.current("magnetometer", {
            x: mag.x,
            y: mag.y,
            z: mag.z,
          });
        });
        mag.start();
        newSensors.magnetometer = mag;
      } catch (e) {
        console.error("Error starting magnetometer:", e);
      }
    }

    // Start linear acceleration
    if (
      sensorStatus.linear_acceleration &&
      "LinearAccelerationSensor" in window
    ) {
      try {
        const linear = new (window as any).LinearAccelerationSensor({
          frequency: 10,
        });
        linear.addEventListener("reading", () => {
          onSensorDataRef.current("linear_acceleration", {
            x: linear.x,
            y: linear.y,
            z: linear.z,
          });
        });
        linear.start();
        newSensors.linear_acceleration = linear;
      } catch (e) {
        console.error("Error starting linear acceleration:", e);
      }
    }

    // Start gravity
    if (sensorStatus.gravity && "GravitySensor" in window) {
      try {
        const grav = new (window as any).GravitySensor({ frequency: 10 });
        grav.addEventListener("reading", () => {
          onSensorDataRef.current("gravity", {
            x: grav.x,
            y: grav.y,
            z: grav.z,
          });
        });
        grav.start();
        newSensors.gravity = grav;
      } catch (e) {
        console.error("Error starting gravity:", e);
      }
    }

    // Start relative orientation
    if (
      sensorStatus.relative_orientation &&
      "RelativeOrientationSensor" in window
    ) {
      try {
        const relOrient = new (window as any).RelativeOrientationSensor({
          frequency: 10,
        });
        relOrient.addEventListener("reading", () => {
          onSensorDataRef.current("relative_orientation", {
            quaternion: relOrient.quaternion,
          });
        });
        relOrient.start();
        newSensors.relative_orientation = relOrient;
      } catch (e) {
        console.error("Error starting relative orientation:", e);
      }
    }

    // Start ambient light
    if (sensorStatus.ambient_light && "AmbientLightSensor" in window) {
      try {
        const light = new (window as any).AmbientLightSensor({ frequency: 1 });
        light.addEventListener("reading", () => {
          onSensorDataRef.current("ambient_light", {
            illuminance: light.illuminance,
          });
        });
        light.start();
        newSensors.ambient_light = light;
      } catch (e) {
        console.error("Error starting ambient light:", e);
      }
    }

    // Start geolocation
    if (sensorStatus.geolocation) {
      const watchId = navigator.geolocation.watchPosition(
        (position) => {
          onSensorDataRef.current("geolocation", {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            altitude: position.coords.altitude,
            heading: position.coords.heading,
            speed: position.coords.speed,
          });
        },
        (error) => {
          console.error("Geolocation error:", error);
        },
        {
          enableHighAccuracy: true,
          maximumAge: 1000,
        }
      );
      newSensors.geolocationWatchId = watchId;
    }

    sensorsRef.current = newSensors;

    return () => {
      if (newSensors.accelerometer) newSensors.accelerometer.stop();
      if (newSensors.gyroscope) newSensors.gyroscope.stop();
      if (newSensors.magnetometer) newSensors.magnetometer.stop();
      if (newSensors.linear_acceleration) newSensors.linear_acceleration.stop();
      if (newSensors.gravity) newSensors.gravity.stop();
      if (newSensors.relative_orientation)
        newSensors.relative_orientation.stop();
      if (newSensors.ambient_light) newSensors.ambient_light.stop();
      if (newSensors.geolocationWatchId !== undefined) {
        navigator.geolocation.clearWatch(newSensors.geolocationWatchId);
      }
    };
  }, [isRecording, sensorStatus, stopAllSensors]);

  return { sensorStatus, stopAllSensors };
};
