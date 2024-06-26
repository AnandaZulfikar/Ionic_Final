import { useState, useEffect } from 'react';
import { Camera, CameraResultType, CameraSource, Photo } from '@capacitor/camera';
import { isPlatform } from '@ionic/react';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Preferences } from '@capacitor/preferences';

const PHOTO_STORAGE = 'photos';

export function usePhotoGallery() {
    const [photos, setPhotos] = useState<UserPhoto[]>([]);

    useEffect(() => {
        const loadSaved = async () => {
            const { value } = await Preferences.get({ key: PHOTO_STORAGE });

            const photosInPreferences = (value ? JSON.parse(value) : []) as UserPhoto[];
            // If running on the web...
            if (!isPlatform('hybrid')) {
                for (let photo of photosInPreferences) {
                    const file = await Filesystem.readFile({
                        path: photo.filepath,
                        directory: Directory.Data,
                    });
                    // Web platform only: Load the photo as base64 data
                    photo.webviewPath = `data:image/jpeg;base64,${file.data}`;
                }
            }
            setPhotos(photosInPreferences);
        };

        loadSaved();
    }, []);

    const takePhoto = async () => {
        const photo = await Camera.getPhoto({
            resultType: CameraResultType.Uri,
            source: CameraSource.Camera,
            quality: 100,
        });

        const savedFileName = await savePicture(photo);
        const newPhotos = [
            {
                filepath: savedFileName,
                webviewPath: photo.webPath,
            },
            ...photos,
        ];
        setPhotos(newPhotos);

        await Preferences.set({ key: PHOTO_STORAGE, value: JSON.stringify(newPhotos) });
    };

    const savePicture = async (photo: Photo): Promise<string> => {
        let base64Data: string;
        if (isPlatform('hybrid')) {
            const file = await Filesystem.readFile({
                path: photo.path!,
            });
            base64Data = file.data;
        } else {
            base64Data = await base64FromPath(photo.webPath!);
        }
        const fileName = new Date().getTime() + '.jpeg';
        await Filesystem.writeFile({
            path: fileName,
            data: base64Data,
            directory: Directory.Data,
        });

        return fileName;
    };

    const deletePhoto = async (photo: UserPhoto) => {
        // Remove this photo from the Photos reference data array
        const newPhotos = photos.filter((p) => p.filepath !== photo.filepath);

        // Update photos array cache by overwriting the existing photo array
        await Preferences.set({ key: PHOTO_STORAGE, value: JSON.stringify(newPhotos) });

        // delete photo file from filesystem
        await Filesystem.deleteFile({
            path: photo.filepath,
            directory: Directory.Data,
        });
        setPhotos(newPhotos);
    };

    const base64FromPath = async (path: string): Promise<string> => {
        const response = await fetch(path);
        const blob = await response.blob();
        return convertBlobToBase64(blob);
    };

    const convertBlobToBase64 = (blob: Blob): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onerror = reject;
            reader.onload = () => {
                if (typeof reader.result === 'string') {
                    resolve(reader.result);
                } else {
                    reject('Method did not return a string');
                }
            };
            reader.readAsDataURL(blob);
        });
    };

    return {
        takePhoto,
        photos,
        deletePhoto
    };
}

export interface UserPhoto {
    filepath: string;
    webviewPath?: string;
}
