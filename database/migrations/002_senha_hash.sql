BEGIN;

ALTER TABLE usuario
RENAME COLUMN senha TO senha_hash;

UPDATE usuario SET senha_hash = '$2b$10$IHHUFy63nvpuAf.NEigVSO3PNyjkI4PcFbOt2Worf8jna2NK6fLR2' WHERE email = 'ana@example.com';
UPDATE usuario SET senha_hash = '$2b$10$ScL0I7cf2CxEnpDQir9js.wQszMvv4ZL8bIglk9Vr5bmOmaXLyySu' WHERE email = 'bruno@example.com';
UPDATE usuario SET senha_hash = '$2b$10$2i3kwfYYRwFcPO//.U4jCehJiX3vyRE3CtIrKK2YQrUW6hSZkgAhy' WHERE email = 'carla@example.com';
UPDATE usuario SET senha_hash = '$2b$10$A69dDUq3XJIz9SUq3SQSluT5fWGal45jgP76.2PnTw/pmID8URuQ2' WHERE email = 'diego@example.com';
UPDATE usuario SET senha_hash = '$2b$10$DbxSN5j4oDYRU1oxmLtlTuU/WtEv1Q/vHurlDy3eLoYpZEgxDgQ1.' WHERE email = 'elisa@example.com';
UPDATE usuario SET senha_hash = '$2b$10$3eRfktnn7ECTaO72HRxwauNBmniXbnKuXukqimAOgKbiMDTPbQXY2' WHERE email = 'felipe@example.com';

COMMIT;