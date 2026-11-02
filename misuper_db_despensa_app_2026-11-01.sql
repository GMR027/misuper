-- ============================================================================
-- Mi Súper — Base de datos completa (esquema + datos iniciales)
-- Archivo: misuper_db_despensa_app_2026-11-01.sql
-- Motor: MySQL 8.0+
--
-- Importar:
--   mysql -u root -p < misuper_db_despensa_app_2026-11-01.sql
--
-- Crea (si no existe) la base despensa_app, sus 9 tablas, las 8 categorías
-- y los 200 productos del catálogo.
-- No elimina la base si ya existe: solo reemplaza las tablas de la app.
--
-- No incluye cuentas de usuario. Crea el Admin inicial con:
--   php scripts/seed.php
-- Define ADMIN_EMAIL y ADMIN_PASSWORD en .env antes de ejecutarlo.
-- ============================================================================

-- MySQL dump 10.13  Distrib 8.0.46, for Linux (aarch64)
--
-- Host: 127.0.0.1    Database: despensa_app
-- ------------------------------------------------------
-- Server version	8.0.46

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Current Database: `despensa_app`
--

CREATE DATABASE /*!32312 IF NOT EXISTS*/ `despensa_app` /*!40100 DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci */ /*!80016 DEFAULT ENCRYPTION='N' */;

USE `despensa_app`;

--
-- Table structure for table `categorias`
--

DROP TABLE IF EXISTS `categorias`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `categorias` (
  `id` int NOT NULL AUTO_INCREMENT,
  `nombre` varchar(80) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_categorias_nombre` (`nombre`)
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `categorias`
--

LOCK TABLES `categorias` WRITE;
/*!40000 ALTER TABLE `categorias` DISABLE KEYS */;
INSERT INTO `categorias` VALUES (5,'Bebidas'),(2,'Carnes'),(4,'Cereales y Legumbres'),(3,'Frutas y Verduras'),(7,'Hogar'),(1,'Lácteos'),(6,'Limpieza'),(8,'Otros');
/*!40000 ALTER TABLE `categorias` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `compra_items`
--

DROP TABLE IF EXISTS `compra_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `compra_items` (
  `id` int NOT NULL AUTO_INCREMENT,
  `compra_id` int NOT NULL,
  `producto_id` int DEFAULT NULL,
  `nombre_libre` varchar(150) DEFAULT NULL,
  `cantidad` decimal(12,3) NOT NULL,
  `precio_total` decimal(12,2) NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_compra` (`compra_id`),
  KEY `idx_producto` (`producto_id`),
  CONSTRAINT `fk_compra_items_compra` FOREIGN KEY (`compra_id`) REFERENCES `compras` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_compra_items_producto` FOREIGN KEY (`producto_id`) REFERENCES `productos` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `chk_compra_items_cantidad` CHECK ((`cantidad` > 0)),
  CONSTRAINT `chk_compra_items_precio` CHECK ((`precio_total` >= 0)),
  CONSTRAINT `chk_compra_items_producto_xor` CHECK (((`producto_id` is not null) xor (`nombre_libre` is not null)))
) ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `compra_items`
--

LOCK TABLES `compra_items` WRITE;
/*!40000 ALTER TABLE `compra_items` DISABLE KEYS */;
/*!40000 ALTER TABLE `compra_items` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `compras`
--

DROP TABLE IF EXISTS `compras`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `compras` (
  `id` int NOT NULL AUTO_INCREMENT,
  `usuario_id` int NOT NULL,
  `fecha` date NOT NULL,
  `total` decimal(12,2) NOT NULL DEFAULT '0.00',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_usuario_fecha` (`usuario_id`,`fecha`),
  CONSTRAINT `fk_compras_usuario` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `compras`
--

LOCK TABLES `compras` WRITE;
/*!40000 ALTER TABLE `compras` DISABLE KEYS */;
/*!40000 ALTER TABLE `compras` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `migration_log`
--

DROP TABLE IF EXISTS `migration_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `migration_log` (
  `id` int NOT NULL AUTO_INCREMENT,
  `filename` varchar(255) NOT NULL,
  `applied_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_migration_log_filename` (`filename`)
) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `migration_log`
--

LOCK TABLES `migration_log` WRITE;
/*!40000 ALTER TABLE `migration_log` DISABLE KEYS */;
INSERT INTO `migration_log` VALUES (1,'001_create_usuarios.sql','2026-11-01 12:51:46'),(2,'002_create_categorias.sql','2026-11-01 12:51:46'),(3,'003_create_productos.sql','2026-11-01 13:11:06'),(4,'004_create_compras.sql','2026-11-01 13:35:38'),(5,'005_create_compra_items.sql','2026-11-01 13:35:38'),(6,'006_create_sugerencias_producto.sql','2026-11-01 14:21:31'),(7,'007_add_avatar_usuarios.sql','2026-11-01 16:06:51'),(8,'008_create_notas.sql','2026-11-01 16:29:49'),(9,'009_create_nota_fotos.sql','2026-11-01 16:29:49'),(10,'010_add_unidades_gr_ml.sql','2026-11-01 16:43:51');
/*!40000 ALTER TABLE `migration_log` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `nota_fotos`
--

DROP TABLE IF EXISTS `nota_fotos`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `nota_fotos` (
  `id` int NOT NULL AUTO_INCREMENT,
  `nota_id` int NOT NULL,
  `ruta` varchar(255) NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_nota_fotos_nota` (`nota_id`),
  CONSTRAINT `fk_nota_fotos_nota` FOREIGN KEY (`nota_id`) REFERENCES `notas` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `nota_fotos`
--

LOCK TABLES `nota_fotos` WRITE;
/*!40000 ALTER TABLE `nota_fotos` DISABLE KEYS */;
/*!40000 ALTER TABLE `nota_fotos` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `notas`
--

DROP TABLE IF EXISTS `notas`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `notas` (
  `id` int NOT NULL AUTO_INCREMENT,
  `usuario_id` int NOT NULL,
  `titulo` varchar(150) NOT NULL,
  `contenido` text,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_notas_usuario_fecha` (`usuario_id`,`created_at`),
  CONSTRAINT `fk_notas_usuario` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `notas`
--

LOCK TABLES `notas` WRITE;
/*!40000 ALTER TABLE `notas` DISABLE KEYS */;
/*!40000 ALTER TABLE `notas` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `productos`
--

DROP TABLE IF EXISTS `productos`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `productos` (
  `id` int NOT NULL AUTO_INCREMENT,
  `nombre` varchar(150) NOT NULL,
  `categoria_id` int NOT NULL,
  `unidad_base` enum('kg','L','pza','gr','ml') NOT NULL,
  `imagen_url` varchar(500) DEFAULT NULL,
  `estado` enum('activo','inactivo') NOT NULL DEFAULT 'activo',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_estado` (`estado`),
  KEY `idx_categoria` (`categoria_id`),
  KEY `idx_nombre` (`nombre`),
  CONSTRAINT `fk_productos_categoria` FOREIGN KEY (`categoria_id`) REFERENCES `categorias` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB AUTO_INCREMENT=201 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `productos`
--

LOCK TABLES `productos` WRITE;
/*!40000 ALTER TABLE `productos` DISABLE KEYS */;
INSERT INTO `productos` VALUES (1,'Leche entera',1,'L','https://images.unsplash.com/photo-1634141510639-d691d86f47be?q=80&w=928&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=NHwxMjA3fDA%3D','activo','2026-11-01 13:29:48','2026-11-01 17:00:30'),(2,'Leche descremada',1,'L',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(3,'Leche en polvo',1,'pza',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(4,'Leche evaporada',1,'pza',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(5,'Leche condensada',1,'pza',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(6,'Yogur natural',1,'pza',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(7,'Yogur de fresa',1,'pza',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(8,'Yogur griego',1,'pza',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(9,'Crema ácida',1,'pza',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(10,'Crema para batir',1,'pza',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(11,'Queso fresco',1,'kg',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(12,'Queso panela',1,'kg',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(13,'Queso manchego',1,'kg',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(14,'Queso oaxaca',1,'kg',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(15,'Queso cottage',1,'pza',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(16,'Queso crema',1,'pza',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(17,'Mantequilla',1,'pza',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(18,'Margarina',1,'pza',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(19,'Requesón',1,'kg',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(20,'Nata para cocinar',1,'pza',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(21,'Bebida láctea',1,'L',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(22,'Leche sabor chocolate',1,'L',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(23,'Leche de almendra',1,'L',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(24,'Queso amarillo en rebanadas',1,'pza',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(25,'Queso parmesano rallado',1,'pza',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(26,'Pechuga de pollo',2,'kg',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(27,'Muslo de pollo',2,'kg',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(28,'Ala de pollo',2,'kg',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(29,'Pollo entero',2,'kg',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(30,'Carne molida de res',2,'kg',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(31,'Carne molida de cerdo',2,'kg',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(32,'Bistec de res',2,'kg',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(33,'Milanesa de res',2,'kg',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(34,'Falda de res',2,'kg',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(35,'Costilla de res',2,'kg',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(36,'Carne para deshebrar',2,'kg',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(37,'Chuleta de cerdo',2,'kg',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(38,'Lomo de cerdo',2,'kg',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(39,'Tocino',2,'kg',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(40,'Salchicha',2,'kg',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(41,'Jamón',2,'kg',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(42,'Chorizo',2,'kg',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(43,'Longaniza',2,'kg',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(44,'Pescado tilapia',2,'kg',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(45,'Camarón',2,'kg',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(46,'Plátano',3,'kg',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(47,'Manzana roja',3,'kg',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(48,'Manzana verde',3,'kg',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(49,'Pera',3,'kg',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(50,'Naranja',3,'kg',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(51,'Mandarina',3,'kg',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(52,'Limón',3,'kg',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(53,'Toronja',3,'kg',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(54,'Papaya',3,'kg',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(55,'Piña',3,'kg',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(56,'Mango',3,'kg',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(57,'Sandía',3,'kg',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(58,'Melón',3,'kg',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(59,'Uva',3,'kg',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(60,'Fresas',3,'kg',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(61,'Aguacate',3,'kg',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(62,'Jitomate',3,'kg',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(63,'Tomate verde',3,'kg',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(64,'Cebolla blanca',3,'kg',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(65,'Cebolla morada',3,'kg',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(66,'Ajo',3,'kg',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(67,'Papa',3,'kg',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(68,'Zanahoria',3,'kg',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(69,'Calabacita',3,'kg',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(70,'Pepino',3,'kg',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(71,'Lechuga',3,'pza',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(72,'Espinaca',3,'kg',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(73,'Col',3,'pza',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(74,'Brócoli',3,'kg',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(75,'Coliflor',3,'pza',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(76,'Chayote',3,'kg',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(77,'Ejotes',3,'kg',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(78,'Chile poblano',3,'kg',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(79,'Chile jalapeño',3,'kg',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(80,'Cilantro',3,'pza',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(81,'Arroz blanco',4,'kg',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(82,'Arroz integral',4,'kg',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(83,'Frijol negro',4,'kg',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(84,'Frijol pinto',4,'kg',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(85,'Frijol bayo',4,'kg',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(86,'Lentejas',4,'kg',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(87,'Garbanzo',4,'kg',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(88,'Habas secas',4,'kg',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(89,'Avena',4,'kg',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(90,'Harina de trigo',4,'kg',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(91,'Harina de maíz',4,'kg',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(92,'Harina de arroz',4,'kg',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(93,'Pasta para sopa',4,'pza',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(94,'Espagueti',4,'pza',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(95,'Coditos',4,'pza',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(96,'Pan de caja',4,'pza',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(97,'Pan bolillo',4,'pza',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(98,'Pan integral',4,'pza',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(99,'Tortillas de maíz',4,'kg',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(100,'Tortillas de harina',4,'pza',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(101,'Galletas de avena',4,'pza',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(102,'Cereal de maíz',4,'pza',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(103,'Cereal de hojuelas',4,'pza',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(104,'Maíz palomero',4,'kg',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(105,'Semillas de girasol',4,'kg',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(106,'Agua purificada',5,'L',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(107,'Agua mineral',5,'L',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(108,'Refresco de cola',5,'L',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(109,'Refresco de limón',5,'L',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(110,'Refresco de naranja',5,'L',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(111,'Jugo de naranja',5,'L',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(112,'Jugo de manzana',5,'L',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(113,'Jugo de uva',5,'L',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(114,'Néctar de mango',5,'L',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(115,'Té helado',5,'L',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(116,'Café molido',5,'pza',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(117,'Café soluble',5,'pza',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(118,'Café en grano',5,'pza',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(119,'Té de manzanilla',5,'pza',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(120,'Té verde',5,'pza',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(121,'Chocolate en polvo',5,'pza',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(122,'Bebida energética',5,'pza',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(123,'Bebida isotónica',5,'L',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(124,'Cerveza clara',5,'pza',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(125,'Cerveza oscura',5,'pza',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(126,'Vino tinto',5,'pza',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(127,'Vino blanco',5,'pza',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(128,'Ron blanco',5,'pza',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(129,'Agua tónica',5,'L',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(130,'Bebida de soya',5,'L',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(131,'Jabón de baño',6,'pza',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(132,'Jabón líquido para manos',6,'pza',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(133,'Shampoo',6,'pza',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(134,'Acondicionador',6,'pza',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(135,'Gel para baño',6,'pza',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(136,'Pasta dental',6,'pza',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(137,'Cepillo dental',6,'pza',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(138,'Hilo dental',6,'pza',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(139,'Desodorante',6,'pza',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(140,'Papel higiénico',6,'pza',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(141,'Toallas sanitarias',6,'pza',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(142,'Pañales',6,'pza',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(143,'Detergente en polvo',6,'pza',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(144,'Detergente líquido',6,'L',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(145,'Suavizante de ropa',6,'L',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(146,'Blanqueador',6,'L',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(147,'Limpiador multiusos',6,'L',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(148,'Limpiador de baños',6,'L',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(149,'Limpiador de vidrios',6,'L',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(150,'Lavatrastes líquido',6,'L',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(151,'Estropajo',6,'pza',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(152,'Fibras para limpieza',6,'pza',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(153,'Bolsas de basura',6,'pza',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(154,'Desinfectante',6,'L',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(155,'Ambientador',6,'pza',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(156,'Servilletas',7,'pza',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(157,'Papel aluminio',7,'pza',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(158,'Plástico autoadherible',7,'pza',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(159,'Bolsas para sándwich',7,'pza',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(160,'Vasos desechables',7,'pza',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(161,'Platos desechables',7,'pza',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(162,'Cubiertos desechables',7,'pza',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(163,'Cerillos',7,'pza',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(164,'Velas',7,'pza',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(165,'Focos',7,'pza',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(166,'Pilas alcalinas',7,'pza',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(167,'Escoba',7,'pza',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(168,'Trapeador',7,'pza',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(169,'Recogedor',7,'pza',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(170,'Cubeta',7,'pza',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(171,'Ganchos para ropa',7,'pza',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(172,'Organizador de plástico',7,'pza',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(173,'Contenedor hermético',7,'pza',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(174,'Almohada',7,'pza',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(175,'Sábanas',7,'pza',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(176,'Huevo blanco',8,'pza',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(177,'Huevo rojo',8,'pza',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(178,'Mayonesa',8,'pza',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(179,'Mostaza',8,'pza',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(180,'Salsa catsup',8,'pza',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(181,'Salsa picante',8,'pza',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(182,'Salsa de tomate',8,'pza',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(183,'Aceite vegetal',8,'L',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(184,'Aceite de oliva',8,'L',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(185,'Vinagre blanco',8,'L',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(186,'Sal de mesa',8,'pza',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(187,'Azúcar estándar',8,'kg',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(188,'Azúcar mascabado',8,'kg',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(189,'Miel de abeja',8,'pza',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(190,'Mermelada de fresa',8,'pza',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(191,'Crema de cacahuate',8,'pza',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(192,'Chocolate en barra',8,'pza',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(193,'Galletas saladas',8,'pza',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(194,'Botanas de maíz',8,'pza',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(195,'Palomitas para microondas',8,'pza',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(196,'Atún en lata',8,'pza',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(197,'Sardinas en lata',8,'pza',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(198,'Frijoles refritos en lata',8,'pza',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(199,'Puré de tomate',8,'pza',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48'),(200,'Caldo de pollo en polvo',8,'pza',NULL,'activo','2026-11-01 13:29:48','2026-11-01 13:29:48');
/*!40000 ALTER TABLE `productos` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `sugerencias_producto`
--

DROP TABLE IF EXISTS `sugerencias_producto`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `sugerencias_producto` (
  `id` int NOT NULL AUTO_INCREMENT,
  `nombre_normalizado` varchar(150) NOT NULL,
  `nombre_original` varchar(150) NOT NULL,
  `estado` enum('pendiente','aprobada','ignorada') NOT NULL DEFAULT 'pendiente',
  `usuario_id` int NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_sugerencia_pendiente` (`nombre_normalizado`,`usuario_id`,`estado`),
  KEY `idx_estado` (`estado`),
  KEY `idx_nombre_norm` (`nombre_normalizado`),
  KEY `fk_sugerencias_producto_usuario` (`usuario_id`),
  CONSTRAINT `fk_sugerencias_producto_usuario` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `sugerencias_producto`
--

LOCK TABLES `sugerencias_producto` WRITE;
/*!40000 ALTER TABLE `sugerencias_producto` DISABLE KEYS */;
/*!40000 ALTER TABLE `sugerencias_producto` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `usuarios`
--

DROP TABLE IF EXISTS `usuarios`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `usuarios` (
  `id` int NOT NULL AUTO_INCREMENT,
  `nombre` varchar(100) NOT NULL,
  `email` varchar(150) NOT NULL,
  `avatar_tipo` enum('foto','preset') DEFAULT NULL,
  `avatar_valor` varchar(255) DEFAULT NULL,
  `password_hash` varchar(255) NOT NULL,
  `rol` enum('usuario','admin') NOT NULL DEFAULT 'usuario',
  `debe_cambiar_password` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_usuarios_email` (`email`)
) ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `usuarios`
-- (sin cuentas: el Admin inicial se crea con php scripts/seed.php)
--

LOCK TABLES `usuarios` WRITE;
/*!40000 ALTER TABLE `usuarios` DISABLE KEYS */;
/*!40000 ALTER TABLE `usuarios` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping events for database 'despensa_app'
--

--
-- Dumping routines for database 'despensa_app'
--
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-11-01 20:01:44
